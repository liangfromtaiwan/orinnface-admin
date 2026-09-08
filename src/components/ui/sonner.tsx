"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  /*
    🔴 アプリ側は ThemeProvider が無く常に light で描いている(index.css の TODO)。
       ここに "system" をそのまま渡すと sonner だけが OS の設定を見て dark を選び、
       明るいトーストに dark 用の文字色 hsl(0,0%,91%) が載って説明文が読めなくなる。
       ThemeProvider を入れるまでは light に固定し、入れたらその値に従う。
  */
  const resolved: ToasterProps["theme"] =
    theme === "system" ? "light" : (theme as ToasterProps["theme"])

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
