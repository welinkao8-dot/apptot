import { getDriverProfilePresentation } from './driverProfilePresentation'

describe('getDriverProfilePresentation', () => {
  it('does not invent vehicle, identity, or verification data', () => {
    expect(getDriverProfilePresentation({ status: 'pending_docs' })).toEqual({
      idLabel: 'ID não disponível',
      vehicleLabel: 'Veículo não informado',
      plateLabel: 'Matrícula não informada',
      verificationLabel: 'Documentos em análise',
      verified: false,
    })
  })

  it('marks only active drivers as verified and uses real available fields', () => {
    expect(getDriverProfilePresentation({ id: 'abcdef123456', status: 'active', vehicle_model: 'Toyota' })).toEqual({
      idLabel: 'ID: ABCDE-AO',
      vehicleLabel: 'Toyota',
      plateLabel: 'Matrícula não informada',
      verificationLabel: 'Verificado',
      verified: true,
    })
  })

  it('shows the persisted dispatch category without inventing a model or plate', () => {
    expect(getDriverProfilePresentation({ status: 'active', vehicle_category: 'moto' })).toMatchObject({
      vehicleLabel: 'Motorizada',
      plateLabel: 'Matrícula não informada',
    })
  })
})
