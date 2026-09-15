export default defineAppConfig({
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'zinc'
    },
    button: {
      slots: {
        base: 'rounded-xl font-semibold shadow-sm'
      }
    },
    card: {
      slots: {
        root: 'rounded-2xl shadow-sm'
      }
    },
    input: {
      slots: {
        base: 'rounded-xl shadow-sm'
      }
    },
    textarea: {
      slots: {
        base: 'rounded-xl shadow-sm'
      }
    },
    checkbox: {
      slots: {
        base: 'rounded-md'
      }
    },
    switch: {
      slots: {
        base: 'shadow-inner'
      }
    },
    select: {
      slots: {
        base: 'rounded-xl shadow-sm',
        content: 'rounded-xl ring-primary/10 shadow-xl'
      }
    },
    popover: {
      slots: {
        content: 'rounded-2xl border border-default bg-default p-3 shadow-xl'
      }
    },
    modal: {
      slots: {
        content: 'rounded-2xl shadow-2xl'
      }
    },
    alert: {
      slots: {
        root: 'rounded-2xl'
      }
    },
    calendar: {
      slots: {
        header: 'rounded-xl bg-primary/5 px-2 py-1',
        headingLabel: 'font-semibold text-primary',
        cellTrigger: 'focus-visible:outline-primary/50'
      }
    }
  }
})
