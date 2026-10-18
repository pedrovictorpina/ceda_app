export default defineAppConfig({
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'zinc'
    },
    button: {
      slots: {
        base: 'rounded-xl font-semibold shadow-sm max-md:min-h-11 max-md:min-w-11'
      },
      compoundVariants: [{
        color: 'primary',
        variant: 'solid',
        class: 'hover:bg-[var(--ui-primary-hover)] active:bg-[var(--ui-primary-hover)] focus-visible:outline-primary'
      }]
    },
    card: {
      slots: {
        root: 'rounded-2xl shadow-sm'
      }
    },
    input: {
      slots: {
        base: 'rounded-xl shadow-sm max-md:min-h-11 max-md:text-base'
      }
    },
    textarea: {
      slots: {
        base: 'rounded-xl shadow-sm'
      }
    },
    inputDate: {
      slots: {
        base: 'w-full min-h-11 rounded-xl shadow-sm',
        trailing: 'pe-0'
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
        base: 'rounded-xl shadow-sm max-md:min-h-11 max-md:text-base',
        content: 'rounded-xl ring-primary/10 shadow-xl'
      }
    },
    radioGroup: {
      slots: {
        item: 'rounded-xl',
        label: 'font-medium'
      }
    },
    navigationMenu: {
      slots: {
        link: 'rounded-xl',
        linkLabel: 'font-medium'
      }
    },
    table: {
      slots: {
        th: 'font-semibold',
        td: 'text-sm'
      }
    },
    accordion: {
      slots: {
        trigger: 'min-h-11 rounded-lg font-medium focus-visible:outline-primary'
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
    drawer: {
      slots: {
        content: 'rounded-t-2xl',
        footer: 'safe-bottom'
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
