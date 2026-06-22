import { Pressable } from '../../../../components/Pressable'

export type SubTabItem<T extends string> = {
  id: T
  label: string
}

export function SubTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTabItem<T>[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="sm-sub-tab-bar shrink-0" role="tablist">
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <Pressable
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`sm-sub-tab-btn ${selected ? 'sm-sub-tab-btn-active' : ''}`}
          >
            {tab.label}
          </Pressable>
        )
      })}
    </div>
  )
}
