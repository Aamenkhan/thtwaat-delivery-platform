'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const axisClass = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }

export function OrdersByStatusChart({ data }: { data: { name: string; count: number }[] }) {
  if (!data.length) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No orders in the last 30 days.
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={axisClass} interval={0} angle={-28} textAnchor="end" height={60} />
        <YAxis allowDecimals={false} tick={axisClass} width={36} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
          }}
        />
        <Bar dataKey="count" name="Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DailyOrdersChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null
  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={axisClass} />
        <YAxis allowDecimals={false} tick={axisClass} width={32} />
        <Tooltip
          labelFormatter={(_, p) => (p?.[0]?.payload?.date as string) ?? ''}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
          }}
        />
        <Bar dataKey="count" name="Created" fill="hsl(221.2 83.2% 53.3%)" radius={[4, 4, 0, 0]} />
      </BarChart>
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
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axisClass} />
        <YAxis type="category" dataKey="label" width={120} tick={axisClass} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
          }}
        />
        <Bar dataKey="orders" name={labelKey} fill="hsl(142.1 76.2% 36.3%)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
