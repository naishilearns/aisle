// Shared primary pink button — used for "Add item", "Add N items", "Save", etc.
// Font: Dela Gothic One 16px. Plus icon: strokeWidth 4 (optional via icon prop).
export default function PrimaryButton({ onClick, children, icon = true, style, ...props }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 56,
        borderRadius: 28,
        border: 0,
        background: 'var(--add-btn-bg)',
        color: 'var(--add-btn-text)',
        fontFamily: '"Dela Gothic One", sans-serif',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        boxShadow: 'var(--add-btn-shadow)',
        width: '100%',
        ...style,
      }}
      {...props}
    >
      {icon && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flex: 'none' }}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
      {children}
    </button>
  )
}
