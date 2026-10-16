import { areDriverDocumentsReady, createDriverDocumentPayload, createDriverDocumentDataUri } from './driverDocuments'

describe('driver document upload payload', () => {
  it('does not consider placeholders, missing fields, or plain strings to be documents', () => {
    expect(areDriverDocumentsReady({ bi_frente: 'doc_uploaded_placeholder', bi_verso: '', carta: 'anything' })).toBe(false)
    expect(createDriverDocumentPayload({ bi_frente: 'x', bi_verso: 'y', carta: 'z' })).toBeNull()
  })

  it('accepts and returns the three actual image data URIs', () => {
    const documents = {
      bi_frente: 'data:image/jpeg;base64,front',
      bi_verso: 'data:image/png;base64,back',
      carta: 'data:image/jpeg;base64,license',
    }
    expect(areDriverDocumentsReady(documents)).toBe(true)
    expect(createDriverDocumentPayload(documents)).toEqual(documents)
  })

  it('accepts supported real image files up to 8 MB and rejects invalid or oversized files', () => {
    expect(createDriverDocumentDataUri({ type: 'image/jpeg', base64: 'abc', fileSize: 100 })).toBe('data:image/jpeg;base64,abc')
    expect(createDriverDocumentDataUri({ type: 'application/pdf', base64: 'abc', fileSize: 100 })).toBeNull()
    expect(createDriverDocumentDataUri({ type: 'image/png', base64: 'abc', fileSize: 9 * 1024 * 1024 })).toBeNull()
    expect(createDriverDocumentDataUri({ type: 'image/jpeg', base64: 'YWJj' })).toBe('data:image/jpeg;base64,YWJj')
  })
})
