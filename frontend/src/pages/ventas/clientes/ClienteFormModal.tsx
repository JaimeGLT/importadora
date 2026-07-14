import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import type { Cliente } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Cliente, 'id'>) => void
  cliente?: Cliente | null
}

export function ClienteFormModal({ open, onClose, onSave, cliente }: Props) {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [correoElectronico, setCorreoElectronico] = useState('')

  useEffect(() => {
    if (!open) return
    setNombre(cliente?.nombre ?? '')
    setApellido(cliente?.apellido ?? '')
    setTelefono(cliente?.telefono ?? '')
    setDireccion(cliente?.direccion ?? '')
    setCorreoElectronico(cliente?.correoElectronico ?? '')
  }, [open, cliente])

  const handleSave = () => {
    if (!nombre.trim()) return
    if (!apellido.trim()) return
    if (!telefono.trim()) return
    onSave({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim() || undefined,
      correoElectronico: correoElectronico.trim() || undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{cliente ? 'Actualizar' : 'Registrar'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-steel-500 mb-1.5">Nombre *</label>
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre del cliente"
            maxLength={100}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-steel-500 mb-1.5">Apellido *</label>
          <Input
            value={apellido}
            onChange={e => setApellido(e.target.value)}
            placeholder="Apellido del cliente"
            maxLength={100}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-steel-500 mb-1.5">Teléfono *</label>
          <Input
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="Número de teléfono"
            maxLength={20}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-steel-500 mb-1.5">Dirección <span className="font-normal text-[#7A7571]">(opcional)</span></label>
          <Input
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder="Dirección del cliente"
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-steel-500 mb-1.5">Correo electrónico <span className="font-normal text-[#7A7571]">(opcional)</span></label>
          <Input
            type="email"
            value={correoElectronico}
            onChange={e => setCorreoElectronico(e.target.value)}
            placeholder="correo@ejemplo.com"
            maxLength={150}
          />
        </div>
      </div>
    </Modal>
  )
}