import { clsx } from 'clsx'

export interface MapperField {
  key: string
  label: string
  required: boolean
  hint?: string
  maxColumns?: number
}

export interface ColumnMapping {
  columns: string[]
  separator: string
}

export type FieldMappings = Record<string, ColumnMapping>

interface ExcelColumnMapperProps {
  fields: MapperField[]
  excelCols: string[]
  mappings: FieldMappings
  fileName?: string
  rowCount?: number
  onAddColumn: (fieldKey: string, col: string) => void
  onRemoveColumn: (fieldKey: string, col: string) => void
  onSetSeparator: (fieldKey: string, sep: string) => void
}

export function ExcelColumnMapper({
  fields, excelCols, mappings, fileName, rowCount,
  onAddColumn, onRemoveColumn, onSetSeparator,
}: ExcelColumnMapperProps) {
  return (
    <div className="space-y-1">
      {/* Cabecera de archivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
        <p className="text-xs text-steel-500">
          {fileName && <span className="font-medium text-steel-700">{fileName}{' · '}</span>}
          {rowCount !== undefined && `${rowCount} filas · `}
          {excelCols.length} columnas detectadas
        </p>
        <p className="text-xs text-steel-400">
          Campos con <span className="text-red-500">*</span> son obligatorios
        </p>
      </div>

      {/* Chips de columnas detectadas */}
      <div className="flex flex-wrap gap-1.5 p-3 bg-steel-50 rounded-lg mb-4">
        {excelCols.map((col) => (
          <span
            key={col}
            className="px-2 py-0.5 bg-white border border-steel-200 rounded text-xs text-steel-600 font-mono"
          >
            {col}
          </span>
        ))}
      </div>

      {/* Filas de mapeo */}
      <div className="space-y-2">
        {fields.map((field) => {
          const mapping = mappings[field.key]
          const availableCols = excelCols.filter((c) => !mapping?.columns.includes(c))

          return (
            <div
              key={field.key}
              className={clsx(
                'grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-3 items-start p-3 rounded-lg border',
                mapping?.columns.length
                  ? 'border-brand-200 bg-brand-50/40'
                  : 'border-steel-100 bg-white',
              )}
            >
              {/* Nombre del campo */}
              <div className="pt-0.5">
                <p className="text-sm font-medium text-steel-800">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </p>
                {field.hint && (
                  <p className="text-xs text-steel-400 mt-0.5">{field.hint}</p>
                )}
              </div>

              {/* Selector de columnas */}
              <div className="flex flex-col gap-2">
                {/* Chips de columnas ya asignadas */}
                {(mapping?.columns.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {mapping!.columns.map((col, i) => (
                      <span
                        key={col}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs font-mono"
                      >
                        {i > 0 && (
                          <span className="text-brand-400 font-sans font-normal">
                            {mapping!.separator || '–'}
                          </span>
                        )}
                        {col}
                        <button
                          onClick={() => onRemoveColumn(field.key, col)}
                          className="ml-0.5 text-brand-400 hover:text-brand-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {mapping!.columns.length >= 2 && (
                      <input
                        value={mapping!.separator}
                        onChange={(e) => onSetSeparator(field.key, e.target.value)}
                        placeholder="sep"
                        className="w-12 h-6 px-1.5 text-xs border border-steel-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-brand-400"
                        title="Separador entre columnas"
                      />
                    )}
                  </div>
                )}

                {/* Dropdown para agregar columna */}
                {availableCols.length > 0 && (mapping?.columns.length ?? 0) < (field.maxColumns ?? Infinity) && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) onAddColumn(field.key, e.target.value) }}
                    className="h-7 w-full sm:max-w-xs rounded border border-steel-200 bg-white px-2 text-xs text-steel-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    <option value="">
                      {(mapping?.columns.length ?? 0) > 0
                        ? '+ Combinar con otra columna…'
                        : 'Seleccionar columna del Excel…'}
                    </option>
                    {availableCols.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
