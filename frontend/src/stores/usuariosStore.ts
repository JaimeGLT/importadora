import { create } from 'zustand'
import type { Usuario } from '@/types'

interface UsuariosState {
  usuarios: Usuario[]
  setUsuarios: (usuarios: Usuario[]) => void
  addUsuario: (usuario: Usuario) => void
  updateUsuario: (usuario: Usuario) => void
  removeUsuario: (id: string) => void
  toggleActivo: (id: string) => void
}

export const useUsuariosStore = create<UsuariosState>()((set) => ({
  usuarios: [],

  setUsuarios: (usuarios) => set({ usuarios }),

  addUsuario: (usuario) =>
    set((state) => ({
      usuarios: [usuario, ...state.usuarios],
    })),

  updateUsuario: (usuario) =>
    set((state) => ({
      usuarios: state.usuarios.map((u) =>
        u.id === usuario.id ? usuario : u,
      ),
    })),

  removeUsuario: (id) =>
    set((state) => ({
      usuarios: state.usuarios.filter((u) => u.id !== id),
    })),

  toggleActivo: (id) =>
    set((state) => ({
      usuarios: state.usuarios.map((u) =>
        u.id === id ? { ...u, activo: !u.activo } : u,
      ),
    })),
}))