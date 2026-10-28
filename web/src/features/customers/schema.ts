import { z } from 'zod'
import { EMIRATE_VALUES } from './emirates'
import type { Customer, CustomerPayload } from './types'

/**
 * Client-side validation mirrors CustomerRequest.php, so most mistakes are caught
 * before a round trip. The server stays the source of truth: its 422 errors
 * (e.g. duplicate TRN) are mapped back onto the same fields.
 *
 * Every field is a string in the form (inputs always produce strings);
 * toPayload() turns empty strings into null for the API.
 */
export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(255),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  phone: z
    .string()
    .trim()
    .regex(/^$|^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number, e.g. +971 50 123 4567.'),
  trn: z
    .string()
    .trim()
    .regex(/^$|^[\d\s-]+$/, 'Digits only.')
    .refine((value) => {
      const digits = value.replace(/\D/g, '')
      return digits === '' || (digits.length === 15 && digits.startsWith('100'))
    }, 'A UAE TRN is 15 digits and starts with 100.'),
  emirate: z.union([z.literal(''), z.enum(EMIRATE_VALUES)]),
  address: z.string().trim().max(1000),
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>

export const emptyCustomerForm: CustomerFormValues = {
  name: '',
  email: '',
  phone: '',
  trn: '',
  emirate: '',
  address: '',
}

export function toFormValues(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    trn: customer.trn ?? '',
    emirate: customer.emirate ?? '',
    address: customer.address ?? '',
  }
}

export function toPayload(values: CustomerFormValues): CustomerPayload {
  const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
  return {
    name: values.name.trim(),
    email: orNull(values.email),
    phone: orNull(values.phone),
    trn: orNull(values.trn.replace(/\D/g, '')),
    emirate: values.emirate === '' ? null : values.emirate,
    address: orNull(values.address),
  }
}
