import { validateDriverDocumentImage } from './driver-document-validation';

describe('validateDriverDocumentImage', () => {
  it('accepts content whose byte signature matches the declared supported image type', () => {
    expect(validateDriverDocumentImage('data:image/jpeg;base64,/9j/')).toBe(true);
    expect(validateDriverDocumentImage('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(validateDriverDocumentImage('data:image/webp;base64,UklGRiQAAABXRUJQ')).toBe(true);
  });

  it('rejects spoofed MIME, malformed data, empty data, and images over 8 MB', () => {
    expect(validateDriverDocumentImage('data:image/jpeg;base64,SGVsbG8=')).toBe(false);
    expect(validateDriverDocumentImage('data:image/png;base64,/9j/')).toBe(false);
    expect(validateDriverDocumentImage('data:image/jpeg;base64,@@@')).toBe(false);
    expect(validateDriverDocumentImage('data:image/jpeg;base64,')).toBe(false);

    const oversizedJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8 * 1024 * 1024)]).toString('base64');
    expect(validateDriverDocumentImage(`data:image/jpeg;base64,${oversizedJpeg}`)).toBe(false);
  });
});
