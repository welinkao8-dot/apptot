import test from 'node:test'
import assert from 'node:assert/strict'

const { submitRequiredReason } = await import('./statusReasonAction.js').catch(() => ({}))

test('required reason prevents submission when it is blank', async () => {
    let error = ''
    let pending = false
    let submitted = false
    const result = await submitRequiredReason({
        reason: '   ',
        action: async () => { submitted = true },
        setPending: value => { pending = value },
        setError: value => { error = value },
        onSuccess: () => assert.fail('must remain open'),
    })

    assert.equal(result, false)
    assert.equal(submitted, false)
    assert.equal(pending, false)
    assert.equal(error, 'Informe um motivo para continuar.')
})

test('keeps the action open and reports a server error until the request succeeds', async () => {
    let error = ''
    let pending = false
    let closed = false
    let rejectRequest
    const request = new Promise((_, reject) => { rejectRequest = reject })
    const resultPromise = submitRequiredReason({
        reason: ' Revisão documental ',
        action: reason => {
            assert.equal(reason, 'Revisão documental')
            return request
        },
        setPending: value => { pending = value },
        setError: value => { error = value },
        onSuccess: () => { closed = true },
    })

    assert.equal(pending, true)
    assert.equal(closed, false)
    rejectRequest({ response: { data: { message: 'Perfil não encontrado' } } })

    assert.equal(await resultPromise, false)
    assert.equal(pending, false)
    assert.equal(closed, false)
    assert.equal(error, 'Perfil não encontrado')
})

test('closes only after the request succeeds and clears the error', async () => {
    let error = 'erro anterior'
    let pending = false
    let closed = false
    let submittedReason = null
    const result = await submitRequiredReason({
        reason: ' Motivo válido ',
        action: async reason => { submittedReason = reason },
        setPending: value => { pending = value },
        setError: value => { error = value },
        onSuccess: () => { closed = true },
    })

    assert.equal(result, true)
    assert.equal(submittedReason, 'Motivo válido')
    assert.equal(pending, false)
    assert.equal(closed, true)
    assert.equal(error, '')
})
