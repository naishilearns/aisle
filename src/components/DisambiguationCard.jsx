import StoreIcon from './StoreIcon'

export default function DisambiguationCard({ itemName, onSelectStore, stores }) {
  return (
    <div
      className="mx-0 mt-4 p-4"
      style={{
        borderRadius: '16px',
        backgroundColor: 'rgba(224,152,32,0.08)',
        border: '1px solid rgba(224,152,32,0.25)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center justify-center rounded-full text-sm font-bold"
          style={{
            width: 24,
            height: 24,
            backgroundColor: 'rgba(224,152,32,0.2)',
            color: '#E09820',
            fontSize: '13px',
          }}
        >
          ?
        </div>
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--text)', fontSize: '13px' }}>
            "{itemName}"
          </p>
          <p className="text-xs" style={{ color: 'var(--text-mid)', fontSize: '11px' }}>
            Where can we find this?
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {Object.entries(stores || {}).map(([id, store]) => (
          <button
            key={id}
            onClick={() => onSelectStore(id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: store.color + '22',
              border: `1.5px solid ${store.color}`,
              color: store.color,
              fontSize: '12px',
            }}
          >
            <StoreIcon storeId={id} size={12} color="currentColor" strokeWidth={2} />
            {store.label}
          </button>
        ))}
      </div>
    </div>
  )
}
