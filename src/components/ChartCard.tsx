import type { ReactNode } from "react"

import { InfoHint } from "@/components/InfoHint"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  /** 集計条件などの説明。タイトル横の i アイコンから開く。 */
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function ChartCard({ title, description, children, className }: Props) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base font-medium">
          {title}
          {description ? (
            <InfoHint label={`${title} の集計条件`}>
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-1">{description}</p>
            </InfoHint>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
