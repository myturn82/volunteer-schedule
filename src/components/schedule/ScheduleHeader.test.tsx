import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScheduleHeader } from './ScheduleHeader'

describe('ScheduleHeader', () => {
  it('displays year and month', () => {
    render(<ScheduleHeader year={2026} month={4} onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getAllByText(/2026/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/04월/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/스케줄/)[0]).toBeInTheDocument()
  })

  it('calls onPrev when < button clicked', () => {
    const onPrev = vi.fn()
    render(<ScheduleHeader year={2026} month={4} onPrev={onPrev} onNext={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /이전/ }))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when > button clicked', () => {
    const onNext = vi.fn()
    render(<ScheduleHeader year={2026} month={4} onPrev={vi.fn()} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
