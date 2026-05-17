import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeSlotCell } from './TimeSlotCell'
import type { CellState, Assignment } from '../../types'

const baseCellState: CellState = {
  isBreaktime: false, isClosed: false, isHoliday: false,
  isNightShift: false, isSaturdayShift: false,
  assignments: [], maxCapacity: 2, isFull: false,
}

const baseAssignment: Assignment = {
  id: '1', tenant_id: 'test-tenant', year: 2026, month: 4, day: 1,
  time_slot: '10-12', volunteer_name: '이연화',
  note: null, user_id: 'u1', created_at: '',
  volunteer_type: 'volunteer', time_sub: null, color: null,
  role_id: null, customer_name: null, customer_phone: null,
}

describe('TimeSlotCell', () => {
  it('shows Break text when isBreaktime (vol col)', () => {
    render(
      <TimeSlotCell
        cellState={{ ...baseCellState, isBreaktime: true }}
        timeSlot="12-13"
        colType="vol"
        onClick={vi.fn()}
        highlightName={null}
      />
    )
    expect(screen.getByText('CLOSE')).toBeInTheDocument()
  })

  it('shows CLOSE text when isClosed (vol col)', () => {
    render(
      <TimeSlotCell
        cellState={{ ...baseCellState, isClosed: true }}
        timeSlot="10-12"
        colType="vol"
        onClick={vi.fn()}
        highlightName={null}
      />
    )
    expect(screen.getByText('CLOSE')).toBeInTheDocument()
  })

  it('shows volunteer names from assignments', () => {
    const state: CellState = { ...baseCellState, assignments: [baseAssignment] }
    render(
      <TimeSlotCell
        cellState={state}
        timeSlot="10-12"
        colType="vol"
        onClick={vi.fn()}
        highlightName={null}
      />
    )
    expect(screen.getByText('이연화')).toBeInTheDocument()
  })

  it('calls onClick when volunteer cell clicked', () => {
    const onClick = vi.fn()
    render(
      <TimeSlotCell
        cellState={baseCellState}
        timeSlot="10-12"
        colType="vol"
        onClick={onClick}
        highlightName={null}
      />
    )
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies night-shift background for night shift', () => {
    render(
      <TimeSlotCell
        cellState={{ ...baseCellState, isNightShift: true }}
        timeSlot="20-22"
        colType="vol"
        onClick={vi.fn()}
        highlightName={null}
      />
    )
  })
})
