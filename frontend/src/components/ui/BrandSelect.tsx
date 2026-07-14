import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Modal, Button, Input } from '@/components/ui'
import { notify } from '@/lib/notify'
import { api } from '@/lib/api'
import { gql } from '@/lib/graphql'
import { MARCAS_QUERY, backendToMarca } from '@/lib/queries/marcas.queries'
import type { Marca } from '@/types'
import { clsx } from 'clsx'

interface BrandSelectProps {
  value: number | null
  onChange: (id: number | null) => void
  marcas?: Marca[]
  label?: string
  placeholder?: string
}

export function BrandSelect({ value, onChange, marcas: marcasProp, label, placeholder = 'Seleccionar marca…' }: BrandSelectProps) {
  const [search, setSearch]           = useState('')
  const [results, setResults]         = useState<Marca[]>([])
  const [fetching, setFetching]       = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [createOpen, setCreateOpen]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [saving, setSaving]           = useState(false)
  const inputRef    = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })

  const fetchMarcas = useCallback((q?: string) => {
    const where = q?.trim() ? { nombre: { contains: q } } : undefined
    setFetching(true)
    gql<{ marca: { nodes: { id: number; nombre: string }[] } }>(MARCAS_QUERY, { where })
      .then(data => {
        const mapped = data.marca.nodes.map(backendToMarca)
        setResults(mapped)
      })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  // Si recibe prop: nunca self-fetcha, solo reacciona cuando el prop se llena
  // Si no recibe prop (undefined): self-fetcha al montar
  useEffect(() => {
    if (marcasProp === undefined) fetchMarcas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (marcasProp !== undefined && marcasProp.length > 0) setResults(marcasProp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcasProp?.length])

  const updatePos = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const handleFocus = () => {
    updatePos()
    setShowDropdown(true)
    if (results.length === 0) fetchMarcas()
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    onChange(null)
    setShowDropdown(true)
    updatePos()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchMarcas(val), 300)
  }

  const handleSelect = (m: Marca) => {
    onChange(m.id)
    setSearch('')
    setShowDropdown(false)
  }

  const selectedMarca = results.find(m => m.id === value)

  const handleCreate = async () => {
    const nombre = newName.trim()
    if (!nombre) { notify.error('Ingresa un nombre'); return }
    setSaving(true)
    try {
      const res = await api.post<{ id: number; nombre: string }>('/marca', { nombre })
      const nueva = backendToMarca({ id: res.id, nombre: res.nombre })
      setResults(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      onChange(nueva.id)
      setNewName('')
      setCreateOpen(false)
      setShowDropdown(false)
      setSearch('')
      notify.success('Marca creada')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Error al crear la marca')
    } finally {
      setSaving(false)
    }
  }

  const dropdown = showDropdown && (
    <div
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-white rounded-lg border border-steel-200 shadow-xl max-h-52 overflow-y-auto"
    >
      {fetching ? (
        <p className="px-3 py-2.5 text-xs text-steel-400">Buscando…</p>
      ) : results.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-steel-400">
          {search.trim() ? 'Sin resultados' : 'Sin marcas — crea una nueva'}
        </p>
      ) : (
        results.map(m => (
          <button
            key={m.id}
            type="button"
            onMouseDown={() => handleSelect(m)}
            className={clsx(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              m.id === value
                ? 'bg-brand-50 text-brand-700 font-medium'
                : 'text-steel-700 hover:bg-brand-50',
            )}
          >
            {m.nombre}
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-steel-700">{label}</label>
      )}
      <div className="relative flex gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={selectedMarca ? selectedMarca.nombre : search}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={placeholder}
            className={clsx(
              'h-9 w-full rounded-lg border border-steel-200 bg-white px-3 text-sm text-steel-900',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            )}
          />
          {createPortal(dropdown, document.body)}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-9 px-3 rounded-lg border border-steel-200 bg-white text-steel-500 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300 transition-colors shrink-0"
          title="Crear nueva marca"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setNewName('') }}
        title="Nueva marca"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setNewName('') }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Crear marca
            </Button>
          </>
        }
      >
        <Input
          label="Nombre de la marca"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Ej: Bosch, NGK, Continental…"
          onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
          autoFocus
        />
      </Modal>
    </div>
  )
}
