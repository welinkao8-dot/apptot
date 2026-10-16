#import <CoreLocation/CoreLocation.h>
#import <math.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

@interface DriverLocationModule : RCTEventEmitter <RCTBridgeModule, CLLocationManagerDelegate>
@property(nonatomic, strong) CLLocationManager *locationManager;
@property(nonatomic, assign) BOOL locationUpdatesRequested;
@property(nonatomic, copy) NSString *uploadUrl;
@property(nonatomic, copy) NSString *uploadToken;
@property(nonatomic, strong) NSURLSession *uploadSession;
@property(nonatomic, strong) CLLocation *pendingUpload;
@property(nonatomic, strong) NSURLSessionDataTask *activeUploadTask;
@property(nonatomic, assign) BOOL uploadRunning;
@property(nonatomic, copy) RCTPromiseResolveBlock authorizationResolve;
@property(nonatomic, copy) RCTPromiseRejectBlock authorizationReject;
@end

@implementation DriverLocationModule

RCT_EXPORT_MODULE(LocationModule);

- (NSArray<NSString *> *)supportedEvents
{
  return @[@"onLocationUpdate"];
}

- (void)ensureLocationManager
{
  if (self.locationManager) return;
  self.locationManager = [[CLLocationManager alloc] init];
  self.locationManager.delegate = self;
  self.locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation;
  // Match Android's 5 m update threshold and avoid waking/uploading for every
  // tiny GPS fluctuation while the external navigation app is foregrounded.
  self.locationManager.distanceFilter = 5.0;
  self.locationManager.activityType = CLActivityTypeAutomotiveNavigation;
  self.locationManager.pausesLocationUpdatesAutomatically = NO;
}

static CLAuthorizationStatus DriverAuthorizationStatus(CLLocationManager *manager)
{
  if (@available(iOS 14.0, *)) return manager.authorizationStatus;
  return [CLLocationManager authorizationStatus];
}

RCT_REMAP_METHOD(ensureBackgroundLocationAuthorization,
                 ensureBackgroundLocationAuthorizationWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self ensureLocationManager];
    CLAuthorizationStatus status = DriverAuthorizationStatus(self.locationManager);
    if (status == kCLAuthorizationStatusAuthorizedAlways) {
      resolve(@YES);
      return;
    }
    if (status == kCLAuthorizationStatusDenied || status == kCLAuthorizationStatusRestricted) {
      reject(@"LOCATION_BACKGROUND_PERMISSION_DENIED", @"Always location authorization is required for driver availability.", nil);
      return;
    }
    self.authorizationResolve = resolve;
    self.authorizationReject = reject;
    [self.locationManager requestAlwaysAuthorization];
  });
}

RCT_EXPORT_METHOD(startLocationUpdates)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self ensureLocationManager];
    if (DriverAuthorizationStatus(self.locationManager) != kCLAuthorizationStatusAuthorizedAlways) return;
    self.locationUpdatesRequested = YES;
    self.locationManager.allowsBackgroundLocationUpdates = YES;
    self.locationManager.showsBackgroundLocationIndicator = YES;
    [self.locationManager startUpdatingLocation];
  });
}

RCT_EXPORT_METHOD(stopLocationUpdates)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    self.locationUpdatesRequested = NO;
    [self.locationManager stopUpdatingLocation];
    self.locationManager.allowsBackgroundLocationUpdates = NO;
    self.locationManager.showsBackgroundLocationIndicator = NO;
  });
}

RCT_EXPORT_METHOD(configureLocationUpload:(NSString *)apiBaseUrl
                  token:(NSString *)token
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *base = [apiBaseUrl isKindOfClass:[NSString class]] ? [apiBaseUrl stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] : @"";
  while ([base hasSuffix:@"/"]) base = [base substringToIndex:base.length - 1];
  NSURLComponents *components = [NSURLComponents componentsWithString:base];
  BOOL isHttps = [components.scheme.lowercaseString isEqualToString:@"https"];
#if DEBUG
  BOOL isAllowedScheme = isHttps || [components.scheme.lowercaseString isEqualToString:@"http"];
#else
  BOOL isAllowedScheme = isHttps;
#endif
  BOOL validUrl = isAllowedScheme && components.host.length > 0 && base.length <= 2048;
  if (!validUrl || ![token isKindOfClass:[NSString class]] || token.length == 0) {
    reject(@"LOCATION_CONFIG_INVALID", @"API URL and authenticated session are required.", nil);
    return;
  }
  @synchronized (self) {
    self.uploadUrl = [base stringByAppendingString:@"/trips/location"];
    self.uploadToken = [token copy];
    if (!self.uploadSession) self.uploadSession = [NSURLSession sessionWithConfiguration:NSURLSessionConfiguration.defaultSessionConfiguration];
  }
  resolve(@YES);
}

RCT_EXPORT_METHOD(clearLocationUploadConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @synchronized (self) {
    self.uploadUrl = nil;
    self.uploadToken = nil;
    self.pendingUpload = nil;
    [self.activeUploadTask cancel];
    self.activeUploadTask = nil;
  }
  resolve(@YES);
}

- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager
{
  CLAuthorizationStatus status = DriverAuthorizationStatus(manager);
  if (status == kCLAuthorizationStatusAuthorizedAlways) {
    if (self.authorizationResolve) self.authorizationResolve(@YES);
    self.authorizationResolve = nil;
    self.authorizationReject = nil;
    if (self.locationUpdatesRequested) {
      manager.allowsBackgroundLocationUpdates = YES;
      [manager startUpdatingLocation];
    }
  } else if (status == kCLAuthorizationStatusDenied || status == kCLAuthorizationStatusRestricted) {
    if (self.authorizationReject) self.authorizationReject(@"LOCATION_BACKGROUND_PERMISSION_DENIED", @"Always location authorization is required for driver availability.", nil);
    self.authorizationResolve = nil;
    self.authorizationReject = nil;
  } else if (status == kCLAuthorizationStatusAuthorizedWhenInUse && self.authorizationReject) {
    self.authorizationReject(@"LOCATION_BACKGROUND_PERMISSION_DENIED", @"Always location authorization is required for driver availability.", nil);
    self.authorizationResolve = nil;
    self.authorizationReject = nil;
  }
}

- (void)locationManager:(CLLocationManager *)manager didUpdateLocations:(NSArray<CLLocation *> *)locations
{
  CLLocation *location = locations.lastObject;
  if (!location || !self.locationUpdatesRequested) return;
  NSTimeInterval timestamp = [location.timestamp timeIntervalSince1970] * 1000.0;
  NSMutableDictionary *coords = [@{
    @"latitude": @(location.coordinate.latitude),
    @"longitude": @(location.coordinate.longitude),
    @"accuracy": @(location.horizontalAccuracy),
    @"speed": @(location.speed),
    @"timestamp": @(timestamp),
  } mutableCopy];
  if (isfinite(location.course) && location.course >= 0.0 && location.course < 360.0) {
    coords[@"heading"] = @(location.course);
  }
  [self sendEventWithName:@"onLocationUpdate" body:@{@"coords": coords}];
  [self enqueueLocationUpload:location timestamp:timestamp];
}

- (void)enqueueLocationUpload:(CLLocation *)location timestamp:(NSTimeInterval)timestamp
{
  if (location.horizontalAccuracy < 0 || location.horizontalAccuracy > 100 || fabs([[NSDate date] timeIntervalSinceDate:location.timestamp]) > 120.0) return;
  BOOL shouldStart = NO;
  @synchronized (self) {
    if (!self.uploadUrl || !self.uploadToken) return;
    self.pendingUpload = location;
    if (!self.uploadRunning) {
      self.uploadRunning = YES;
      shouldStart = YES;
    }
  }
  if (shouldStart) [self uploadPendingLocation];
}

- (void)uploadPendingLocation
{
  CLLocation *location;
  NSString *urlString;
  NSString *token;
  NSURLSession *session;
  @synchronized (self) {
    location = self.pendingUpload;
    self.pendingUpload = nil;
    urlString = self.uploadUrl;
    token = self.uploadToken;
    session = self.uploadSession;
    if (!location || !urlString || !token || !session) {
      self.uploadRunning = NO;
      return;
    }
  }

  NSMutableDictionary *payload = [@{
    @"lat": @(location.coordinate.latitude),
    @"lng": @(location.coordinate.longitude),
    @"accuracy": @(location.horizontalAccuracy),
    @"timestamp": @([location.timestamp timeIntervalSince1970] * 1000.0),
  } mutableCopy];
  if (isfinite(location.course) && location.course >= 0.0 && location.course < 360.0) {
    payload[@"heading"] = @(location.course);
  }
  NSError *jsonError = nil;
  NSData *body = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&jsonError];
  NSURL *url = [NSURL URLWithString:urlString];
  if (!body || !url || jsonError) {
    [self finishLocationUpload];
    return;
  }
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"POST";
  request.timeoutInterval = 3.0;
  [request setValue:[@"Bearer " stringByAppendingString:token] forHTTPHeaderField:@"Authorization"];
  [request setValue:@"application/json; charset=utf-8" forHTTPHeaderField:@"Content-Type"];
  request.HTTPBody = body;

  NSURLSessionDataTask *task = [session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    // No token, coordinates, or server body is logged. A later GPS fix is the retry.
    [self finishLocationUpload];
  }];
  @synchronized (self) { self.activeUploadTask = task; }
  [task resume];
}

- (void)finishLocationUpload
{
  BOOL hasPending = NO;
  @synchronized (self) {
    self.activeUploadTask = nil;
    hasPending = self.pendingUpload != nil && self.uploadUrl != nil && self.uploadToken != nil;
    if (!hasPending) self.uploadRunning = NO;
  }
  if (hasPending) [self uploadPendingLocation];
}

- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error
{
  // Availability remains blocked until a valid GPS fix arrives.
}

@end
