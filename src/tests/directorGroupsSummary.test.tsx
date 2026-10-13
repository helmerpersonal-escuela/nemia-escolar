import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DirectorGroupsSummary } from '../features/groups/components/DirectorGroupsSummary'

const groups = [
  { id: 'a1', grade: '1', section: 'A', students: [{ count: 8 }] },
  { id: 'b1', grade: '1', section: 'B', students: [{ count: 7 }] },
  { id: 'a2', grade: '2', section: 'A', students: [{ count: 9 }] },
  { id: 'b2', grade: '2', section: 'B', students: [{ count: 6 }] },
  { id: 'a3', grade: '3', section: 'A', students: [{ count: 8 }] },
  { id: 'b3', grade: '3', section: 'B', students: [{ count: 5 }] },
]

describe('DirectorGroupsSummary', () => {
  it('muestra totales y desglose por grado', () => {
    render(<DirectorGroupsSummary groups={groups} onSelect={() => {}} />)
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getByText('43')).toBeTruthy()
    expect(screen.getAllByText('2 grupos · 15 alumnos')).toHaveLength(2)
    expect(screen.getByText('2 grupos · 13 alumnos')).toBeTruthy()
  })
  it('abre grupo al tocarlo y al escribir "2° b"', () => {
    const onSelect = vi.fn()
    render(<DirectorGroupsSummary groups={groups} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('3° B'))
    expect(onSelect).toHaveBeenLastCalledWith('b3')
    fireEvent.change(screen.getByLabelText(/Abrir grupo/), { target: { value: '2° b' } })
    fireEvent.click(screen.getByText('Abrir'))
    expect(onSelect).toHaveBeenLastCalledWith('b2')
    fireEvent.change(screen.getByLabelText(/Abrir grupo/), { target: { value: '5Z' } })
    fireEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('No existe ese grupo.')).toBeTruthy()
  })
})
