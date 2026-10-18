import React from 'react'
import { formatLocationAge } from '../services/driverLocation'

export default function DriverLocationContent({ location, isLoading, onRetry, children }) {
    if (isLoading) {
        return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
            A carregar a última localização…
        </div>
    }

    if (!location?.position) {
        return <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: '24px', textAlign: 'center', color: '#64748b' }}>
            <div>
                <p>{location?.state === 'error'
                    ? 'Não foi possível carregar a localização.'
                    : 'Ainda não há uma localização válida enviada por este motorista.'}</p>
                {location?.state === 'error' && (
                    <button type="button" onClick={onRetry} style={{ border: 0, borderRadius: 8, padding: '8px 14px', background: '#e91e63', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        Tentar novamente
                    </button>
                )}
            </div>
        </div>
    }

    return <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {location.state !== 'fresh' && (
            <div role="status" style={{ padding: '8px 12px', background: location.state === 'stale' ? '#fff7ed' : '#f1f5f9', color: location.state === 'stale' ? '#9a3412' : '#475569', fontSize: 12, fontWeight: 700 }}>
                {location.state === 'stale'
                    ? `Posição desatualizada (${formatLocationAge(location.ageMs)}).`
                    : 'Não foi possível confirmar a hora desta posição.'}
            </div>
        )}
        {location.accuracyMeters != null && (
            <div style={{ padding: '6px 12px', background: '#f8fafc', color: '#475569', fontSize: 12 }}>
                Precisão reportada pelo GPS: ±{Math.round(location.accuracyMeters)} m
            </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
}
