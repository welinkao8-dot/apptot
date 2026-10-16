export function getDriverProfilePresentation(user) {
  const verified = user?.status === 'active'
  const vehicleCategories = { moto: 'Motorizada', car: 'Carro', truck: 'Camião' }
  return {
    idLabel: user?.id ? `ID: ${user.id.substring(0, 5).toUpperCase()}-AO` : 'ID não disponível',
    vehicleLabel: user?.vehicle_model?.trim() || vehicleCategories[user?.vehicle_category] || 'Veículo não informado',
    plateLabel: user?.license_plate?.trim() || 'Matrícula não informada',
    verificationLabel: verified ? 'Verificado' : 'Documentos em análise',
    verified,
  }
}
