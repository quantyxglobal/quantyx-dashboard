// Website Submission Service
// Handles quote requests and contact inquiries from the website
// Uses Supabase client directly for better compatibility

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { AWSSESService } from './aws-ses-service'
import { v4 as uuidv4 } from 'uuid'

// Lazy-loaded Supabase client
let _supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    // Access environment variables at runtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables are required')
    }
    
    _supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }
  return _supabaseClient
}

export interface QuoteRequestData {
  fullName: string
  email: string
  phone: string
  firmName?: string
  caseDetails?: string
  services: string[]
}

export interface ContactInquiryData {
  firstName: string
  lastName: string
  email: string
  phone: string
  company?: string
  services: string[]
  message: string
}

export interface FileUploadData {
  filename: string
  originalName: string
  s3Key: string
  fileSize: number
  mimeType: string
  downloadUrl: string
  downloadExpiresAt: Date
}

export class WebsiteSubmissionService {
  private sesService: AWSSESService

  constructor() {
    this.sesService = new AWSSESService()
  }

  /**
   * Creates a new quote request with uploaded files
   */
  async createQuoteRequest(
    data: QuoteRequestData,
    files: FileUploadData[]
  ): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      const quoteId = uuidv4()

      // Create quote request in database
      const now = new Date().toISOString()
      const { data: quoteRequest, error: quoteError } = await getSupabaseClient()
        .from('quote_requests')
        .insert({
          id: quoteId,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
          organization_name: data.firmName || null,
          case_description: data.caseDetails || null,
          status: 'PENDING',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()

      if (quoteError) {
        console.error('Error creating quote request:', quoteError)
        return { 
          id: '', 
          success: false, 
          error: quoteError.message 
        }
      }

      // Create file records if any files were uploaded
      if (files.length > 0) {
        const fileRecords = files.map(file => ({
          id: uuidv4(),
          quote_request_id: quoteId,
          filename: file.filename,
          original_filename: file.originalName,
          s3_key: file.s3Key,
          file_size: file.fileSize,
          mime_type: file.mimeType,
          download_url: file.downloadUrl,
          download_expires_at: file.downloadExpiresAt.toISOString(),
        }))

        const { error: filesError } = await getSupabaseClient()
          .from('quote_files')
          .insert(fileRecords)

        if (filesError) {
          console.error('Error creating quote files:', filesError)
          // Don't fail the entire request if files fail
        }
      }

      return { id: quoteId, success: true }

    } catch (error) {
      console.error('Error creating quote request:', error)
      return { 
        id: '', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Creates a new contact inquiry
   */
  async createContactInquiry(
    data: ContactInquiryData
  ): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      const inquiryId = uuidv4()

      // Create contact inquiry in database
      const now = new Date().toISOString()
      const { data: inquiry, error } = await getSupabaseClient()
        .from('contact_inquiries')
        .insert({
          id: inquiryId,
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone: data.phone,
          organization_name: data.company || null,
          services_interest: data.services,
          message: data.message,
          status: 'NEW',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating contact inquiry:', error)
        return { 
          id: '', 
          success: false, 
          error: error.message 
        }
      }

      return { id: inquiryId, success: true }

    } catch (error) {
      console.error('Error creating contact inquiry:', error)
      return { 
        id: '', 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Gets all quote requests (for admin dashboard)
   */
  async getQuoteRequests(limit: number = 50, offset: number = 0) {
    const { data, error } = await getSupabaseClient()
      .from('quote_requests')
      .select(`
        *,
        files:quote_files(*),
        converted_case:cases(case_number, title)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching quote requests:', error)
      return []
    }

    return data || []
  }

  /**
   * Gets all contact inquiries (for admin dashboard)
   */
  async getContactInquiries(limit: number = 50, offset: number = 0) {
    const { data, error } = await getSupabaseClient()
      .from('contact_inquiries')
      .select(`
        *,
        assigned_to:users!contact_inquiries_assigned_to_id_fkey(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching contact inquiries:', error)
      return []
    }

    return data || []
  }

  /**
   * Updates quote request status
   */
  async updateQuoteRequestStatus(
    id: string, 
    status: 'PENDING' | 'UNDER_REVIEW' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED',
    assignedToId?: string,
    estimatedCost?: number,
    estimatedHours?: number,
    notes?: string
  ) {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (assignedToId) updateData.assigned_to_id = assignedToId
    if (status === 'QUOTED') updateData.quoted_at = new Date().toISOString()
    if (estimatedCost !== undefined) updateData.estimated_cost = estimatedCost
    if (estimatedHours !== undefined) updateData.estimated_hours = estimatedHours
    if (notes !== undefined) updateData.internal_notes = notes

    const { data, error } = await getSupabaseClient()
      .from('quote_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating quote request:', error)
      throw error
    }

    return data
  }

  /**
   * Updates contact inquiry status
   */
  async updateContactInquiryStatus(
    id: string,
    status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESPONDED' | 'FOLLOW_UP' | 'RESOLVED' | 'CLOSED',
    assignedToId?: string,
    notes?: string
  ) {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (assignedToId) updateData.assigned_to_id = assignedToId
    if (status === 'RESPONDED') updateData.responded_at = new Date().toISOString()
    if (notes !== undefined) updateData.internal_notes = notes

    const { data, error } = await getSupabaseClient()
      .from('contact_inquiries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact inquiry:', error)
      throw error
    }

    return data
  }
}

// Lazy-loaded singleton instance
let _websiteSubmissionServiceInstance: WebsiteSubmissionService | null = null

export const getWebsiteSubmissionService = (): WebsiteSubmissionService => {
  if (!_websiteSubmissionServiceInstance) {
    _websiteSubmissionServiceInstance = new WebsiteSubmissionService()
  }
  return _websiteSubmissionServiceInstance
}

export const websiteSubmissionService = new Proxy({} as WebsiteSubmissionService, {
  get(target, prop) {
    return getWebsiteSubmissionService()[prop as keyof WebsiteSubmissionService]
  }
})