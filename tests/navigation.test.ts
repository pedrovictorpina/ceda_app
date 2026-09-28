import { describe, expect, it } from 'vitest'
import type { NavigationItem, NavigationSection } from '../app/types/domain'
import {
  bottomNavProfile,
  buildSearchIndex,
  findActiveItem,
  findActiveTab,
  findSectionForPath,
  pickBottomNavItems,
  pushRecentRoute,
  searchNavigation
} from '../app/utils/navigation'

const items: NavigationItem[] = [
  { label: 'Início', icon: 'i-home', to: '/inicio' },
  { label: 'Conteúdo', icon: 'i-book', to: '/palavra-do-dia', matches: ['/noticias', '/galeria'] },
  { label: 'Eventos', icon: 'i-calendar', to: '/eventos' },
  { label: 'Loja', icon: 'i-bag', to: '/loja' },
  { label: 'Células', icon: 'i-cells', to: '/celulas' },
  { label: 'Operação da loja', icon: 'i-box', to: '/operacao', keywords: ['caixa'] }
]

const sections: NavigationSection[] = [
  {
    id: 'operacao',
    label: 'Operação da loja',
    tabs: [
      { label: 'Atendimento', icon: 'i-a', to: '/operacao' },
      { label: 'Estoque', icon: 'i-e', to: '/operacao/estoque' },
      { label: 'Relatórios', icon: 'i-r', to: '/operacao/relatorios' }
    ]
  }
]

describe('navigation', () => {
  it('chooses the bottom bar by role, in priority order', () => {
    expect(bottomNavProfile({ isAdminView: true, canOperateStore: true, caresForChildren: true })).toBe('admin')
    expect(bottomNavProfile({ isAdminView: false, canOperateStore: true, caresForChildren: true })).toBe('staff')
    expect(bottomNavProfile({ isAdminView: false, canOperateStore: false, caresForChildren: true })).toBe('parent')
    expect(bottomNavProfile({ isAdminView: false, canOperateStore: false, caresForChildren: false })).toBe('member')
  })

  it('keeps the bottom bar order and skips routes the person cannot see', () => {
    expect(pickBottomNavItems(items, 'member').map(item => item.to)).toEqual(['/inicio', '/eventos', '/celulas', '/loja'])
    expect(pickBottomNavItems(items, 'parent').map(item => item.to)).toEqual(['/inicio', '/eventos', '/loja'])
  })

  it('activates grouped items for their sibling pages', () => {
    expect(findActiveItem(items, '/noticias/culto-de-domingo')?.label).toBe('Conteúdo')
    expect(findActiveItem(items, '/operacao/estoque')?.label).toBe('Operação da loja')
    expect(findActiveItem(items, '/perfil')).toBeUndefined()
  })

  it('picks the most specific tab inside a section', () => {
    const section = findSectionForPath(sections, '/operacao/estoque')
    expect(section?.id).toBe('operacao')
    expect(findActiveTab(section!.tabs, '/operacao/estoque')?.label).toBe('Estoque')
    expect(findActiveTab(section!.tabs, '/operacao')?.label).toBe('Atendimento')
    expect(findSectionForPath(sections, '/loja')).toBeUndefined()
  })

  it('searches labels, keywords and section tabs ignoring accents', () => {
    const index = buildSearchIndex(items, sections)
    expect(searchNavigation(index, 'celulas').map(entry => entry.to)).toEqual(['/celulas'])
    expect(searchNavigation(index, 'CAIXA').map(entry => entry.to)).toEqual(['/operacao'])
    expect(searchNavigation(index, 'estoque').map(entry => entry.to)).toEqual(['/operacao/estoque'])
    expect(searchNavigation(index, '  ')).toEqual([])
    expect(index.filter(entry => entry.to === '/operacao')).toHaveLength(1)
    expect(index.find(entry => entry.to === '/operacao/estoque')?.context).toBe('Operação da loja')
  })

  it('keeps recent routes unique, newest first and limited', () => {
    const recent = ['/loja', '/celulas', '/eventos', '/feed']
    expect(pushRecentRoute(recent, '/celulas')).toEqual(['/celulas', '/loja', '/eventos', '/feed'])
    expect(pushRecentRoute(recent, '/oracao')).toEqual(['/oracao', '/loja', '/celulas', '/eventos'])
    expect(recent).toEqual(['/loja', '/celulas', '/eventos', '/feed'])
  })
})
