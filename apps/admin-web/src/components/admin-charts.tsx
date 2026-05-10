'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const axisClass = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
  fontSize: 12,
}

const gradientDefs = (
  <defs>
    <linearGradient id="primaryGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="hsl(237 84% 62%)" />
      <stop offset="100%" stopColor="hsl(268 72% 62%)" />
    </linearGradient>
    <linearGradient id="successGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="hsl(152 72% 40%)" />
      <stop offset="100%" stopColor="hsl(170 70% 40%)" />
    </linearGradient>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="hsl(237 84% 62%)" stopOpacity={0.3} />
      <stop offset="100%" stopColor="hsl(237 84% 62%)" stopOpacity={0.02} />
    </linearGradient>
  </defs>
)

export function OrdersByStatusChart({ data }: { data: { name: string; count: number }[] }) {
  if (!data.length) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No orders in the last 30 days.
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 36 }}>
        {gradientDefs}
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis
          dataKey="name"
          tick={axisClass}
          interval={0}
          angle={-28}
          textAnchor="end"
          height={64}
          axisLine={false}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={axisClass} width={36} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        <Bar dataKey="count" name="Orders" fill="url(#primaryGrad)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DailyOrdersChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null
  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }))
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {gradientDefs}
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis dataKey="label" tick={axisClass} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={axisClass} width={32} axisLine={false} tickLine={false} />
        <Tooltip
          labelFormatter={(_, p) => (p?.[0]?.payload?.date as string) ?? ''}
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(237 84% 62%)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(237 84% 62%)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="count"
          name="Created"
          stroke="hsl(237 84% 62%)"
          strokeWidth={2.5}
          fill="url(#areaFill)"
          dot={{ fill: 'hsl(237 84% 62%)', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: 'hsl(237 84% 62%)', stroke: 'white', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function HubVolumeChart({
  data,
  labelKey,
}: {
  data: { label: string; orders: number }[]
  labelKey: string
}) {
  if (!data.length) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No hub volume data.
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        {gradientDefs}
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axisClass} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={130} tick={axisClass} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
        <Bar dataKey="orders" name={labelKey} fill="url(#successGrad)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
