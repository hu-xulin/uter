import test from 'node:test'
import assert from 'node:assert/strict'
function evaluate({pin, live}) {
  return Boolean(pin && live && pin.governed_fingerprint && pin.governed_fingerprint !== 'PENDING_MACHINE_RECOMPUTATION' &&
    pin.governed_fingerprint === live.fingerprint && live.seal_intact === true &&
    pin.registry_blob_sha === live.components.registry_blob_sha &&
    pin.registry_version === live.components.registry_version &&
    pin.specification_integrity_digest === live.components.specification_integrity_digest &&
    pin.specification_integrity_digest === live.components.specification_integrity_computed)
}
test('valid machine pin is accepted only when fingerprint and seal match',()=>{
  const live={fingerprint:'a'.repeat(64),seal_intact:true,components:{registry_blob_sha:'blob',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64),specification_integrity_computed:'b'.repeat(64)}}
  const pin={governed_fingerprint:live.fingerprint,registry_blob_sha:'blob',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64)}
  assert.equal(evaluate({pin,live}),true)
})
test('pending fingerprint is never accepted',()=>{
  const live={fingerprint:'a'.repeat(64),seal_intact:true,components:{registry_blob_sha:'blob',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64),specification_integrity_computed:'b'.repeat(64)}}
  const pin={governed_fingerprint:'PENDING_MACHINE_RECOMPUTATION',registry_blob_sha:'blob',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64)}
  assert.equal(evaluate({pin,live}),false)
})
test('a stale registry pin is rejected',()=>{
  const live={fingerprint:'a'.repeat(64),seal_intact:true,components:{registry_blob_sha:'new',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64),specification_integrity_computed:'b'.repeat(64)}}
  const pin={governed_fingerprint:live.fingerprint,registry_blob_sha:'old',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64)}
  assert.equal(evaluate({pin,live}),false)
})
test('a broken seal is rejected even if the pin fingerprint matches',()=>{
  const live={fingerprint:'a'.repeat(64),seal_intact:false,components:{registry_blob_sha:'blob',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64),specification_integrity_computed:'c'.repeat(64)}}
  const pin={governed_fingerprint:live.fingerprint,registry_blob_sha:'blob',registry_version:'1.2.3',specification_integrity_digest:'b'.repeat(64)}
  assert.equal(evaluate({pin,live}),false)
})
