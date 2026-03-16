'use client'

type ConfirmSubmitButtonProps = {
  children: React.ReactNode
  className: string
  confirmMessage: string
  disabled?: boolean
  disabledReason?: string
  formAction?: ((formData: FormData) => void | Promise<void>) | string
  name?: string
  value?: string
}

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
  disabled = false,
  disabledReason,
  formAction,
  name,
  value,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      name={name}
      value={value}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        if (!window.confirm(confirmMessage)) {
          event.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
