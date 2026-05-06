import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeSlotCell } from './TimeSlotCell'
import type { CellState } from '../../types'

const baseCellState: CellState = {
  isBreaktime: false, isClosed: false, isHoliday: false,
  isNightShift: false, isSaturdayShift: false,
  assignments: [], maxCapacity: 2, isFull: false,
}

describe('TimeSlotCell', () => {
  it('shows BREAKTIME text when isBreaktime', () => {
    render(<TimeSlotCell cellState={{ ...baseCellState, isBreaktime: true }} onClick={vi.fn()} highlightName={null} />)
    expect(screen.getByText('BREAKTIME')).toBeInTheDocument()
  })

  it('shows CLOSE text when isClosed', () => {
    render(<TimeSlotCell cellState={{ ...baseCellState, isClosed: true }} onClick={vi.fn()} highlightName={null} />)
    expect(screen.getByText('CLOSE')).toBeInTheDocument()
  })

  it('shows volunteer names from assignments', () => {
    const state: CellState = {
      ...baseCellState,
      assignments: [{ id: '1', year: 2026, month: 4, day: 1, time_slot: '10-12', volunteer_name: '이연화', note: null, user_id: 'u1', created_at: '' }],
    }
    render(<TimeSlotCell cellState={state} onClick={vi.fn()} highlightName={null} />)
    expect(screen.getByText('이연화')).toBeInTheDocument()
  })

  it('calls onClick when editable cell clicked', () => {
    const onClick = vi.fn()
    render(<TimeSlotCell cellState={baseCellState} onClick={onClick} highlightName={null} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies pink background for night shift', () => {
    const { container } = render(
      <TimeSlotCell cellState={{ ...baseCellState, isNightShift: true }} onClick={vi.fn()} highlightName={null} />
    )
    expect(container.firstChild).toHaveClass('bg-pink-50')
  })
})
