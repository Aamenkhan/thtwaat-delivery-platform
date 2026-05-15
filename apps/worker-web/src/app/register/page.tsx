'use client'

/**
 * Worker onboarding micro-flow (UI + API):
 * 1–2) Phone + hub + role → OTP (existing)
 * 3–6) KYC photos: Aadhaar F/B, PAN F/B, vehicle F/B, driving licence
 * 7) Address + vehicle class + fuel + vehicle number
 * 8) Numbers: Aadhaar, PAN, DL, bank, IFSC, UPI + mobile re-confirm
 * 9) PUT profile
 *10) ₹999 fee (demo self-report only if API env WORKER_SELF_REPORT_ONBOARDING_FEE=1)
 *11) Training acknowledgements (3 videos) → POST training-complete
 * → Dashboard (admin still must set isVerified before gig online)
 */

import { getApiBaseUrl } from '@repo/web-core/api'
import { Button } from '@repo/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PincodeInput } from '../../components/PincodeInput'
import { workerFetch } from '../../lib/worker-api'
import { writeWorkerSession } from '../../lib/worker-session'
import { uploadWorkerKycPhoto } from '../../lib/worker-kyc-upload'

const STEPS = 10
const TRAINING_IDS = ['safety-intro', 'parcel-handling', 'customer-etiquette'] as const

function PhotoRow({
  label,
  onFile,
  busy,
}: {
  label: string
  onFile: (f: File) => Promise<void>
  busy: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={busy}
        className="text-xs"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
        }}
      />
    </label>
  )
}

export default function WorkerRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [hubId, setHubId] = useState('')
  const [role, setRole] = useState<'PICKUP_WORKER' | 'DELIVERY_WORKER' | ''>('')
  const [workerId, setWorkerId] = useState('')
  const [otp, setOtp] = useState('')

  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleFuelType, setVehicleFuelType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  const [aadhaar, setAadhaar] = useState('')
  const [panNumber, setPanNumber] = useState('')
  const [license, setLicense] = useState('')
  const [upi, setUpi] = useState('')
  const [bankAcc, setBankAcc] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [confirmPhone, setConfirmPhone] = useState('')

  const [trainingTick, setTrainingTick] = useState<Record<string, boolean>>({})

  async function sendOtp() {
    setMsg(null)
    if (!name.trim() || phone.length < 10 || !hubId.trim() || !role) {
      setMsg('Name, phone, hub ID, role ज़रूरी।')
      return
    }
    setLoading(true)
    try {
      const res = await workerFetch<{
        workerId: string
        message?: string
        _devOtp?: string
        delivery?: 'whatsapp' | 'log_only'
      }>('/workers/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone,
          role,
          hubId: hubId.trim(),
        }),
        skipAuth: true,
      })
      setWorkerId(res.workerId)
      if (res._devOtp) {
        setMsg(`Dev OTP: ${res._devOtp}`)
      } else if (res.delivery === 'log_only') {
        setMsg('OTP Render API logs mein — WhatsApp env set karein ya logs dekhein.')
      } else if (res.message) {
        setMsg(res.message)
      }
      setStep(2)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Register failed')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await workerFetch<{ token: string; worker: { id: string } }>(
        '/workers/verify-phone',
        {
          method: 'POST',
          body: JSON.stringify({ workerId, otp }),
          skipAuth: true,
        }
      )
      writeWorkerSession(res.token, res.worker.id)
      setWorkerId(res.worker.id)
      setStep(3)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'OTP failed')
    } finally {
      setLoading(false)
    }
  }

  async function uploadK(type: Parameters<typeof uploadWorkerKycPhoto>[1], file: File) {
    if (!workerId) return
    setLoading(true)
    setMsg(null)
    try {
      await uploadWorkerKycPhoto(workerId, type, file)
      setMsg('Photo saved ✓')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  async function submitProfile() {
    if (!workerId) return
    if (confirmPhone.replace(/\D/g, '') !== phone.replace(/\D/g, '')) {
      setMsg('Mobile number दोबारा वही 10 अंक डालें जो ऊपर है।')
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      await workerFetch(`/workers/${workerId}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          address,
          city,
          pincode,
          vehicleNumber,
          vehicleType,
          vehicleFuelType: vehicleFuelType || undefined,
          upiId: upi || undefined,
          bankAccount: bankAcc || undefined,
          bankIfsc: bankIfsc || undefined,
          aadhaarNumber: aadhaar || undefined,
          panNumber: panNumber.replace(/\s/g, '').toUpperCase() || undefined,
          drivingLicenseNo: license || undefined,
        }),
      })
      setStep(9)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  async function tryFeeSelfReport() {
    if (!workerId) return
    setLoading(true)
    setMsg(null)
    try {
      await workerFetch(`/workers/${workerId}/onboarding/fee-self-report`, { method: 'POST' })
      setMsg('Fee recorded (demo).')
      setStep(10)
    } catch (e) {
      setMsg(
        e instanceof Error
          ? `${e.message} — Production: ₹999 hub / Razorpay से भरवाएँ; Render पर WORKER_SELF_REPORT_ONBOARDING_FEE=1 से demo।`
          : 'Fee step failed'
      )
    } finally {
      setLoading(false)
    }
  }

  async function submitTraining() {
    if (!workerId) return
    const watchedIds = TRAINING_IDS.filter((id) => trainingTick[id])
    if (watchedIds.length !== TRAINING_IDS.length) {
      setMsg('तीनों training वीडियो confirm करें — नहीं तो onboard cancel माना जाएगा।')
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      await workerFetch(`/workers/${workerId}/onboarding/training-complete`, {
        method: 'POST',
        body: JSON.stringify({ watchedIds }),
      })
      router.replace('/dashboard')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Training submit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${(step / STEPS) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Step {step} / {STEPS} · API {getApiBaseUrl()}
      </p>
      {msg ? <p className="mt-2 text-sm text-destructive">{msg}</p> : null}

      {step === 1 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            Full name
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Phone
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          <label className="text-sm">
            Home hub ID (admin से लें)
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 font-mono text-sm"
              value={hubId}
              onChange={(e) => setHubId(e.target.value.trim())}
            />
          </label>
          <div className="grid gap-2">
            <button
              type="button"
              className={`min-h-14 rounded-xl border-2 px-3 text-left text-sm font-medium ${
                role === 'PICKUP_WORKER' ? 'border-indigo-500 bg-indigo-500/10' : ''
              }`}
              onClick={() => setRole('PICKUP_WORKER')}
            >
              PICKUP WORKER
            </button>
            <button
              type="button"
              className={`min-h-14 rounded-xl border-2 px-3 text-left text-sm font-medium ${
                role === 'DELIVERY_WORKER' ? 'border-indigo-500 bg-indigo-500/10' : ''
              }`}
              onClick={() => setRole('DELIVERY_WORKER')}
            >
              DELIVERY WORKER
            </button>
          </div>
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void sendOtp()}>
            Send OTP
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            OTP
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 text-center text-2xl tracking-widest"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void verifyOtp()}>
            Verify
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">Aadhaar — front फिर back (clear photo)</p>
          <PhotoRow label="Aadhaar front" busy={loading} onFile={(f) => uploadK('aadhaar', f)} />
          <PhotoRow label="Aadhaar back" busy={loading} onFile={(f) => uploadK('aadhaar_back', f)} />
          <Button className="min-h-12" onClick={() => setStep(4)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">PAN — front + back</p>
          <PhotoRow label="PAN front" busy={loading} onFile={(f) => uploadK('pan_front', f)} />
          <PhotoRow label="PAN back" busy={loading} onFile={(f) => uploadK('pan_back', f)} />
          <Button className="min-h-12" onClick={() => setStep(5)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">Vehicle — type + fuel + number + front/back photo</p>
          <div className="flex flex-wrap gap-2">
            {['Bike', 'Auto', 'Mini Truck'].map((v) => (
              <button
                key={v}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  vehicleType === v ? 'border-indigo-500 bg-indigo-500/10' : ''
                }`}
                onClick={() => setVehicleType(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Petrol', 'Diesel', 'CNG', 'Electric'].map((v) => (
              <button
                key={v}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  vehicleFuelType === v ? 'border-indigo-500 bg-indigo-500/10' : ''
                }`}
                onClick={() => setVehicleFuelType(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <label className="text-sm">
            Vehicle number
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 uppercase"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            />
          </label>
          <PhotoRow label="Vehicle front (with number plate)" busy={loading} onFile={(f) => uploadK('vehicle_front', f)} />
          <PhotoRow label="Vehicle back" busy={loading} onFile={(f) => uploadK('vehicle_back', f)} />
          <Button className="min-h-12" onClick={() => setStep(6)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium">Driving licence photo</p>
          <PhotoRow label="DL (front legible)" busy={loading} onFile={(f) => uploadK('license', f)} />
          <Button className="min-h-12" onClick={() => setStep(7)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            Address
            <textarea
              className="mt-1 min-h-[4.5rem] w-full rounded-lg border px-3 py-2 text-base"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <PincodeInput
            value={pincode}
            onChange={setPincode}
            onPincodeResolved={(p) => setCity(p.city)}
          />
          <label className="text-sm">
            City
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <Button className="min-h-12" onClick={() => setStep(8)}>
            Next
          </Button>
        </div>
      ) : null}

      {step === 8 ? (
        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            Aadhaar (12 digits)
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              inputMode="numeric"
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
            />
          </label>
          <label className="text-sm">
            PAN (10 chars)
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3 uppercase"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.replace(/\s/g, '').slice(0, 10).toUpperCase())}
            />
          </label>
          <label className="text-sm">
            Driving licence no.
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
          </label>
          <label className="text-sm">
            UPI ID
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              placeholder="name@paytm"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Bank account
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={bankAcc}
              onChange={(e) => setBankAcc(e.target.value)}
            />
          </label>
          <label className="text-sm">
            IFSC
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
            />
          </label>
          <label className="text-sm">
            Mobile फिर से (UPI / bank verify)
            <input
              className="mt-1 min-h-12 w-full rounded-lg border px-3"
              inputMode="numeric"
              value={confirmPhone}
              onChange={(e) => setConfirmPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void submitProfile()}>
            Save profile
          </Button>
        </div>
      ) : null}

      {step === 9 ? (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <p className="font-medium">Onboarding fee ₹999</p>
          <p className="text-muted-foreground">
            भुगतान के बाद 2–3 दिन में admin documents verify करेगा। Razorpay वायर करने तक demo के लिए API env
            WORKER_SELF_REPORT_ONBOARDING_FEE=1।
          </p>
          <Button className="min-h-12" disabled={loading} variant="secondary" onClick={() => void tryFeeSelfReport()}>
            Record fee (demo / internal)
          </Button>
          <p className="text-xs text-muted-foreground">
            Hub / Razorpay से fee जमा करने के बाद admin को बताएँ; fee DB में mark होने के बाद ही training पूरी हो
            सकती है।
          </p>
          <Button
            className="min-h-12"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setMsg(null)
              setStep(10)
            }}
          >
            फीस जमा / admin ने mark किया — training पर जाएँ
          </Button>
        </div>
      ) : null}

      {step === 10 ? (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <p className="font-medium">Training videos (ज़रूरी)</p>
          <p className="text-muted-foreground">
            नहीं देखा तो onboard रद्द माना जा सकता है। तीनों टिक करें — वीडियो URL बाद में admin से जोड़ें।
          </p>
          {TRAINING_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(trainingTick[id])}
                onChange={(e) => setTrainingTick((t) => ({ ...t, [id]: e.target.checked }))}
              />
              <span className="font-mono text-xs">{id}</span>
            </label>
          ))}
          <Button className="min-h-14 w-full" disabled={loading} onClick={() => void submitTraining()}>
            Complete training & go to dashboard
          </Button>
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="text-primary underline">
          Login
        </Link>
      </p>
    </main>
  )
}
