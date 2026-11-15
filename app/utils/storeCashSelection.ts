export function cashSelectionChanges(selected: string[], saved: string[]) {
  return {
    add: selected.filter(id => !saved.includes(id)),
    remove: saved.filter(id => !selected.includes(id))
  }
}
