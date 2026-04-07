'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle, UserPlus } from "lucide-react"
import { registerUser } from "@/app/actions/register"

// Country and state data
const COUNTRIES = [
  { value: 'United States', label: 'United States' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Australia', label: 'Australia' },
  { value: 'India', label: 'India' },
  { value: 'Other', label: 'Other' }
]

const STATES_BY_COUNTRY: Record<string, string[]> = {
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
    'Wisconsin', 'Wyoming'
  ],
  'Canada': [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon'
  ],
  'Australia': [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland',
    'South Australia', 'Tasmania', 'Victoria', 'Western Australia'
  ],
  'India': [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal'
  ],
  'United Kingdom': [
    'England', 'Scotland', 'Wales', 'Northern Ireland'
  ]
}

const registrationSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  firmName: z.string().min(2, "Firm name must be at least 2 characters"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number")
})

type RegistrationFormData = z.infer<typeof registrationSchema>

export function RegistrationForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [firmExistsMessage, setFirmExistsMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedState, setSelectedState] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
    watch,
    setValue
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: 'onBlur',
  })

  const availableStates = selectedCountry && STATES_BY_COUNTRY[selectedCountry] 
    ? STATES_BY_COUNTRY[selectedCountry] 
    : []

  const onSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    setFirmExistsMessage(null)
    
    try {
      const formData = new FormData()
      formData.append('firstName', data.firstName)
      formData.append('lastName', data.lastName)
      formData.append('email', data.email)
      formData.append('firmName', data.firmName)
      formData.append('addressLine1', data.addressLine1)
      formData.append('addressLine2', data.addressLine2 || '')
      formData.append('city', data.city)
      formData.append('state', data.state)
      formData.append('country', data.country)
      formData.append('password', data.password)
      
      const result = await registerUser(formData)
      
      // Handle case where result is undefined or null
      if (!result) {
        console.error('Registration returned undefined result')
        setError('Registration failed. Please try again.')
        return
      }
      
      if (result.success) {
        setSuccess('Registration successful! You can now sign in with your credentials.')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else if ((result as any).firmExists) {
        setFirmExistsMessage((result as any).message)
      } else {
        setError(result.error || 'Registration failed. Please try again.')
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full shadow-elegant bg-white/80 backdrop-blur-sm border-[hsl(240_15%_88%)]">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Image
              src="/quantyx-logo.png"
              alt="Quantyx Global"
              width={64}
              height={64}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Create Account
        </CardTitle>
        <CardDescription className="text-center text-[hsl(240_8%_46%)]">
          Join Quantyx Global Case Management
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          {firmExistsMessage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900 mb-2">Organization Already Exists</h4>
                  <p className="text-sm text-amber-800 mb-3 leading-relaxed">
                    {firmExistsMessage}
                  </p>
                  <div className="bg-white/50 rounded-md p-3 border border-amber-200">
                    <p className="text-xs font-medium text-amber-900 mb-2">Need Help?</p>
                    <ul className="text-xs text-amber-800 space-y-1">
                      <li>• Ask a colleague to invite you from their dashboard</li>
                      <li>• Contact support at <a href="mailto:support@quantyxg.com" className="font-medium underline hover:text-amber-900">support@quantyxg.com</a></li>
                      <li>• Call us for immediate assistance</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  {...register("firstName")}
                  className={errors.firstName ? 'border-destructive focus-visible:ring-destructive' : touchedFields.firstName && !errors.firstName ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                  disabled={isSubmitting}
                />
                {touchedFields.firstName && !errors.firstName && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                )}
                {errors.firstName && (
                  <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                )}
              </div>
              {errors.firstName && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.firstName.message}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Smith"
                  {...register("lastName")}
                  className={errors.lastName ? 'border-destructive focus-visible:ring-destructive' : touchedFields.lastName && !errors.lastName ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                  disabled={isSubmitting}
                />
                {touchedFields.lastName && !errors.lastName && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                )}
                {errors.lastName && (
                  <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                )}
              </div>
              {errors.lastName && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.lastName.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="john@smithlaw.com"
                {...register("email")}
                className={errors.email ? 'border-destructive focus-visible:ring-destructive' : touchedFields.email && !errors.email ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                disabled={isSubmitting}
              />
              {touchedFields.email && !errors.email && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.email && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.email && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.email.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="firmName">Law Firm Name</Label>
            <div className="relative">
              <Input
                id="firmName"
                type="text"
                placeholder="Smith & Associates Law Firm"
                {...register("firmName")}
                className={errors.firmName ? 'border-destructive focus-visible:ring-destructive' : touchedFields.firmName && !errors.firmName ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                disabled={isSubmitting}
              />
              {touchedFields.firmName && !errors.firmName && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.firmName && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.firmName && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.firmName.message}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              If your firm already exists, you&apos;ll be added to it
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <div className="relative">
              <Input
                id="addressLine1"
                type="text"
                placeholder="123 Main Street"
                {...register("addressLine1")}
                className={errors.addressLine1 ? 'border-destructive focus-visible:ring-destructive' : touchedFields.addressLine1 && !errors.addressLine1 ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                disabled={isSubmitting}
              />
              {touchedFields.addressLine1 && !errors.addressLine1 && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.addressLine1 && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.addressLine1 && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.addressLine1.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <div className="relative">
              <Input
                id="addressLine2"
                type="text"
                placeholder="Suite 100"
                {...register("addressLine2")}
                className="bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select
              value={selectedCountry}
              onValueChange={(value) => {
                setSelectedCountry(value)
                setValue('country', value, { shouldValidate: true })
                // Reset state when country changes
                setSelectedState('')
                setValue('state', '', { shouldValidate: false })
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger className={errors.country ? 'border-destructive' : touchedFields.country && !errors.country ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)]'}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.country && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.country.message}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <div className="relative">
                <Input
                  id="city"
                  type="text"
                  placeholder="New York"
                  {...register("city")}
                  className={errors.city ? 'border-destructive focus-visible:ring-destructive' : touchedFields.city && !errors.city ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                  disabled={isSubmitting}
                />
                {touchedFields.city && !errors.city && (
                  <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                )}
                {errors.city && (
                  <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                )}
              </div>
              {errors.city && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.city.message}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              {availableStates.length > 0 ? (
                <>
                  <Select
                    value={selectedState}
                    onValueChange={(value) => {
                      setSelectedState(value)
                      setValue('state', value, { shouldValidate: true })
                    }}
                    disabled={isSubmitting || !selectedCountry}
                  >
                    <SelectTrigger className={errors.state ? 'border-destructive' : touchedFields.state && !errors.state ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)]'}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.state.message}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="relative">
                    <Input
                      id="state"
                      type="text"
                      placeholder={selectedCountry ? "Enter state/province" : "Select country first"}
                      {...register("state")}
                      className={errors.state ? 'border-destructive focus-visible:ring-destructive' : touchedFields.state && !errors.state ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                      disabled={isSubmitting || !selectedCountry}
                    />
                    {touchedFields.state && !errors.state && (
                      <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                    )}
                    {errors.state && (
                      <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {errors.state && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errors.state.message}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                {...register("password")}
                className={errors.password ? 'border-destructive focus-visible:ring-destructive' : touchedFields.password && !errors.password ? 'border-green-500' : 'bg-[hsl(240_20%_98%)]/50 border-[hsl(240_15%_88%)] hover:border-primary/50 transition-colors'}
                disabled={isSubmitting}
              />
              {touchedFields.password && !errors.password && (
                <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-600" />
              )}
              {errors.password && (
                <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
              )}
            </div>
            {errors.password && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.password.message}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <Button
            type="submit"
            variant="professional"
            size="lg"
            className="w-full shadow-elegant hover:shadow-glow transition-all duration-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              'Creating Account...'
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </>
            )}
          </Button>

          <div className="text-center pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link 
                href="/login" 
                className="text-primary hover:text-primary-glow font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}