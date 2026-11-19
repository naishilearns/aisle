import { Settings } from 'react-feather'
import { storeColors } from '../utils/storeColors'

export default function TabRow({ activeTab, onTabChange, allStores, allStoreOrder, onOpenSettings, theme = 'dark' }) {
  const tabs = [
    { id: 'all', label: 'All', color: null },
    ...allStoreOrder.map(id => ({
      id,
      label: allStores[id]?.label ?? id,
      color: allStores[id]?.color ?? '#888',
    })),
  ]

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-1">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        const isAll = tab.id === 'all'

        if (isAll) {
          return (
            <button
              key="all"
              onClick={() => onTabChange('all')}
              className="flex-shrink-0 px-4 rounded-full text-sm transition-all duration-150"
              style={isActive
                ? { height: 40, backgroundColor: 'var(--tab-active-bg)', color: 'var(--tab-active-text)', border: '1px solid var(--tab-active-bg)', fontWeight: 800, fontSize: 14 }
                : { height: 40, backgroundColor: 'var(--tab-inactive-bg, transparent)', color: 'var(--tab-inactive-text)', border: '1px solid var(--tab-inactive-border)', fontWeight: 700, fontSize: 14 }
              }
            >
              All
            </button>
          )
        }

        const colors = storeColors(tab.color, theme)
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-shrink-0 px-4 rounded-full text-sm transition-all duration-150"
            style={isActive
              ? { height: 40, backgroundColor: colors.deep, color: '#FFFFFF', border: `1px solid ${colors.deep}`, fontWeight: 800, fontSize: 14 }
              : { height: 40, backgroundColor: 'var(--tab-inactive-bg, transparent)', color: 'var(--tab-inactive-text)', border: '1px solid var(--tab-inactive-border)', fontWeight: 700, fontSize: 14 }
            }
          >
            {tab.label}
          </button>
        )
      })}

      <button
        onClick={onOpenSettings}
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: 'var(--tab-inactive-bg, transparent)',
          border: '1px solid var(--tab-inactive-border)',
          marginLeft: 2, color: 'var(--settings-icon)',
        }}
      >
        <Settings size={15} color="currentColor" />
      </button>
    </div>
  )
}
