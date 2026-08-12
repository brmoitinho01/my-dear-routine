export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          actual_cost: number | null
          business_unit_id: string
          created_at: string
          created_by: string | null
          derived_at: string | null
          derived_by: string | null
          due_date: string | null
          estimated_cost: number | null
          expected_result: string | null
          how: string | null
          id: string
          initiative_id: string | null
          kpi_id: string | null
          objective_id: string | null
          organization_id: string
          origin_note: string | null
          origin_type: string | null
          owner_user_id: string | null
          plan_id: string | null
          progress: number
          start_date: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
          where_place: string | null
          why: string | null
        }
        Insert: {
          actual_cost?: number | null
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          derived_at?: string | null
          derived_by?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          expected_result?: string | null
          how?: string | null
          id?: string
          initiative_id?: string | null
          kpi_id?: string | null
          objective_id?: string | null
          organization_id: string
          origin_note?: string | null
          origin_type?: string | null
          owner_user_id?: string | null
          plan_id?: string | null
          progress?: number
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          where_place?: string | null
          why?: string | null
        }
        Update: {
          actual_cost?: number | null
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          derived_at?: string | null
          derived_by?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          expected_result?: string | null
          how?: string | null
          id?: string
          initiative_id?: string | null
          kpi_id?: string | null
          objective_id?: string | null
          organization_id?: string
          origin_note?: string | null
          origin_type?: string | null
          owner_user_id?: string | null
          plan_id?: string | null
          progress?: number
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          where_place?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "action_plans_derived_by_fk"
            columns: ["derived_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_initiative_fk"
            columns: ["initiative_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_initiatives"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "action_plans_kpi_fk"
            columns: ["kpi_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "action_plans_objective_fk"
            columns: ["objective_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "action_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          correlation_id: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          occurred_at: string
          organization_id: string | null
          request_id: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          request_id?: string | null
          source: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          request_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_fk"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_units_company_fk"
            columns: ["company_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "business_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          legal_name: string | null
          name: string
          organization_id: string
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          legal_name?: string | null
          name: string
          organization_id: string
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          organization_id?: string
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_strategy_profiles: {
        Row: {
          assessment_version: number
          business_model: string
          business_unit_id: string
          created_at: string
          created_by: string | null
          diagnosis_reviewed_at: string | null
          diagnosis_reviewed_by: string | null
          horizon_years: number
          id: string
          journey_step: string
          library_version: number
          main_challenge: string | null
          notes: string | null
          organization_id: string
          sector_code: string
          size_band: string
          stage: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_version?: number
          business_model?: string
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          diagnosis_reviewed_at?: string | null
          diagnosis_reviewed_by?: string | null
          horizon_years?: number
          id?: string
          journey_step?: string
          library_version?: number
          main_challenge?: string | null
          notes?: string | null
          organization_id: string
          sector_code?: string
          size_band?: string
          stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_version?: number
          business_model?: string
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          diagnosis_reviewed_at?: string | null
          diagnosis_reviewed_by?: string | null
          horizon_years?: number
          id?: string
          journey_step?: string
          library_version?: number
          main_challenge?: string | null
          notes?: string | null
          organization_id?: string
          sector_code?: string
          size_band?: string
          stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_strategy_profiles_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "company_strategy_profiles_diagnosis_reviewed_by_fkey"
            columns: ["diagnosis_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_strategy_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_measurements: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          id: string
          kpi_id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          source_evidence: string | null
          status: string
          updated_at: string
          updated_by: string | null
          validated_at: string | null
          validated_by: string | null
          value: number
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kpi_id: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          source_evidence?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          value: number
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kpi_id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          source_evidence?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_measurements_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kpi_measurements_kpi_fk"
            columns: ["kpi_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kpi_measurements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_measurements_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          baseline_value: number | null
          business_unit_id: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: string
          formula: string | null
          frequency: string
          id: string
          name: string
          objective_id: string | null
          organization_id: string
          owner_user_id: string | null
          pillar_id: string | null
          plan_id: string
          source: string | null
          status: string
          target_max: number | null
          target_min: number | null
          target_value: number | null
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          baseline_value?: number | null
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string
          formula?: string | null
          frequency?: string
          id?: string
          name: string
          objective_id?: string | null
          organization_id: string
          owner_user_id?: string | null
          pillar_id?: string | null
          plan_id: string
          source?: string | null
          status?: string
          target_max?: number | null
          target_min?: number | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          baseline_value?: number | null
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string
          formula?: string | null
          frequency?: string
          id?: string
          name?: string
          objective_id?: string | null
          organization_id?: string
          owner_user_id?: string | null
          pillar_id?: string | null
          plan_id?: string
          source?: string | null
          status?: string
          target_max?: number | null
          target_min?: number | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kpis_objective_fk"
            columns: ["objective_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_pillar_fk"
            columns: ["pillar_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_pillars"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kpis_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      org_people: {
        Row: {
          created_at: string
          created_by: string | null
          employee_code: string | null
          full_name: string
          home_scope_id: string
          id: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
          work_email: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_code?: string | null
          full_name: string
          home_scope_id: string
          id?: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          work_email?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_code?: string | null
          full_name?: string
          home_scope_id?: string
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_people_home_scope_id_fkey"
            columns: ["home_scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_people_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizational_positions: {
        Row: {
          created_at: string
          created_by: string | null
          decision_authority_text: string | null
          expected_headcount: number
          id: string
          key_deliverables_text: string | null
          organization_id: string
          parent_position_id: string | null
          purpose: string | null
          responsibilities_text: string | null
          scope_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision_authority_text?: string | null
          expected_headcount?: number
          id?: string
          key_deliverables_text?: string | null
          organization_id: string
          parent_position_id?: string | null
          purpose?: string | null
          responsibilities_text?: string | null
          scope_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision_authority_text?: string | null
          expected_headcount?: number
          id?: string
          key_deliverables_text?: string | null
          organization_id?: string
          parent_position_id?: string | null
          purpose?: string | null
          responsibilities_text?: string | null
          scope_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizational_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizational_positions_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_parent_org_fk"
            columns: ["parent_position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organizational_positions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          allowed_scope_types: string[]
          code: string
          created_at: string
          description: string
          domain: string
          effective_from: string
          effective_to: string | null
          id: string
          is_system: boolean
          risk: string
        }
        Insert: {
          allowed_scope_types: string[]
          code: string
          created_at?: string
          description: string
          domain: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_system?: boolean
          risk: string
        }
        Update: {
          allowed_scope_types?: string[]
          code?: string
          created_at?: string
          description?: string
          domain?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_system?: boolean
          risk?: string
        }
        Relationships: []
      }
      plan_diagnostics: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          assumptions: string | null
          business_unit_id: string
          context_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          opportunities: string | null
          organization_id: string
          plan_id: string
          review_status: string
          strategic_priorities: string | null
          strengths: string | null
          submitted_at: string | null
          submitted_by: string | null
          threats: string | null
          updated_at: string
          updated_by: string | null
          weaknesses: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string | null
          business_unit_id: string
          context_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opportunities?: string | null
          organization_id: string
          plan_id: string
          review_status?: string
          strategic_priorities?: string | null
          strengths?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          threats?: string | null
          updated_at?: string
          updated_by?: string | null
          weaknesses?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string | null
          business_unit_id?: string
          context_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opportunities?: string | null
          organization_id?: string
          plan_id?: string
          review_status?: string
          strategic_priorities?: string | null
          strengths?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          threats?: string | null
          updated_at?: string
          updated_by?: string | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_diagnostics_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_diagnostics_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "plan_diagnostics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_diagnostics_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "plan_diagnostics_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      position_assignments: {
        Row: {
          assignment_type: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          notes: string | null
          organization_id: string
          person_id: string
          position_id: string
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          person_id: string
          position_id: string
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          person_id?: string
          position_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_person_fk"
            columns: ["person_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "org_people"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "assignments_position_fk"
            columns: ["position_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organizational_positions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "position_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fk"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_fk"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string
          effective_from: string
          effective_to: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_executions: {
        Row: {
          business_unit_id: string
          competence_date: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_date: string
          evidence: string | null
          id: string
          notes: string | null
          organization_id: string
          owner_user_id: string | null
          status: string
          template_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          competence_date: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          evidence?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          status?: string
          template_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          competence_date?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          evidence?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          status?: string
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_executions_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "routine_executions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_executions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_executions_template_fk"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      routine_templates: {
        Row: {
          business_unit_id: string
          company_id: string
          created_at: string
          created_by: string | null
          custom_interval_days: number | null
          day_of_month: number | null
          description: string | null
          frequency: string
          id: string
          name: string
          organization_id: string
          owner_user_id: string | null
          requires_evidence: boolean
          scheduled_time: string | null
          start_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
          weekday: number | null
        }
        Insert: {
          business_unit_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_interval_days?: number | null
          day_of_month?: number | null
          description?: string | null
          frequency: string
          id?: string
          name: string
          organization_id: string
          owner_user_id?: string | null
          requires_evidence?: boolean
          scheduled_time?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          weekday?: number | null
        }
        Update: {
          business_unit_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_interval_days?: number | null
          day_of_month?: number | null
          description?: string | null
          frequency?: string
          id?: string
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          requires_evidence?: boolean
          scheduled_time?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_templates_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "routine_templates_company_fk"
            columns: ["company_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "routine_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_templates_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_types: {
        Row: {
          code: string
          created_at: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          created_at?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      scopes: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          label: string
          organization_id: string
          parent_scope_id: string | null
          scope_type: string
          status: string
          target_id: string | null
          target_table: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          label: string
          organization_id: string
          parent_scope_id?: string | null
          scope_type: string
          status?: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          label?: string
          organization_id?: string
          parent_scope_id?: string | null
          scope_type?: string
          status?: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scopes_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_parent_fk"
            columns: ["parent_scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_type_fk"
            columns: ["scope_type"]
            isOneToOne: false
            referencedRelation: "scope_types"
            referencedColumns: ["code"]
          },
        ]
      }
      strategic_initiatives: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          expected_result: string | null
          id: string
          kpi_id: string | null
          objective_id: string
          organization_id: string
          owner_user_id: string | null
          pillar_id: string | null
          plan_id: string
          priority: string
          progress: number
          risk_id: string | null
          sponsor_user_id: string | null
          start_date: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          expected_result?: string | null
          id?: string
          kpi_id?: string | null
          objective_id: string
          organization_id: string
          owner_user_id?: string | null
          pillar_id?: string | null
          plan_id: string
          priority?: string
          progress?: number
          risk_id?: string | null
          sponsor_user_id?: string | null
          start_date?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          expected_result?: string | null
          id?: string
          kpi_id?: string | null
          objective_id?: string
          organization_id?: string
          owner_user_id?: string | null
          pillar_id?: string | null
          plan_id?: string
          priority?: string
          progress?: number
          risk_id?: string | null
          sponsor_user_id?: string | null
          start_date?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_initiatives_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_initiatives_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_initiatives_kpi_fk"
            columns: ["kpi_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_initiatives_objective_fk"
            columns: ["objective_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_initiatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_initiatives_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_initiatives_pillar_fk"
            columns: ["pillar_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_pillars"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_initiatives_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_initiatives_risk_fk"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_risks"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_initiatives_sponsor_user_id_fkey"
            columns: ["sponsor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_initiatives_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_objectives: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          owner_user_id: string | null
          pillar_id: string
          plan_id: string
          progress: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          owner_user_id?: string | null
          pillar_id: string
          plan_id: string
          progress?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          owner_user_id?: string | null
          pillar_id?: string
          plan_id?: string
          progress?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_objectives_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_objectives_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_objectives_pillar_fk"
            columns: ["pillar_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_pillars"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_objectives_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      strategic_pillars: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          plan_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          plan_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_pillars_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_pillars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_pillars_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      strategic_plans: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string
          company_id: string
          created_at: string
          created_by: string | null
          cycle_end: string
          cycle_start: string
          description: string | null
          id: string
          mission: string | null
          organization_id: string
          review_status: string
          status: string
          strategic_north: string | null
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          updated_by: string | null
          values_text: string | null
          version: number
          vision: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          cycle_end: string
          cycle_start: string
          description?: string | null
          id?: string
          mission?: string | null
          organization_id: string
          review_status?: string
          status?: string
          strategic_north?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          values_text?: string | null
          version?: number
          vision?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          cycle_end?: string
          cycle_start?: string
          description?: string | null
          id?: string
          mission?: string | null
          organization_id?: string
          review_status?: string
          status?: string
          strategic_north?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          values_text?: string | null
          version?: number
          vision?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plans_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_plans_company_fk"
            columns: ["company_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_plans_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_risks: {
        Row: {
          business_unit_id: string
          contingency: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          impact: string
          objective_id: string | null
          organization_id: string
          owner_user_id: string | null
          plan_id: string
          probability: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          contingency?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          impact?: string
          objective_id?: string | null
          organization_id: string
          owner_user_id?: string | null
          plan_id: string
          probability?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          contingency?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          impact?: string
          objective_id?: string | null
          organization_id?: string
          owner_user_id?: string | null
          plan_id?: string
          probability?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_risks_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_risks_objective_fk"
            columns: ["objective_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategic_risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_risks_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_risks_plan_fk"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_plans"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      strategy_assessment_answers: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          id: string
          option_score: number
          option_value: string
          organization_id: string
          question_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          option_score: number
          option_value: string
          organization_id: string
          question_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          option_score?: number
          option_value?: string
          organization_id?: string
          question_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_assessment_answers_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategy_assessment_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "strategy_assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_assessment_questions: {
        Row: {
          code: string
          created_at: string
          dimension: string
          help_text: string | null
          id: string
          options: Json
          prompt: string
          sort_order: number
          status: string
          version: number
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          dimension: string
          help_text?: string | null
          id?: string
          options: Json
          prompt: string
          sort_order?: number
          status?: string
          version?: number
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          dimension?: string
          help_text?: string | null
          id?: string
          options?: Json
          prompt?: string
          sort_order?: number
          status?: string
          version?: number
          weight?: number
        }
        Relationships: []
      }
      strategy_diagnosis_selections: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          id: string
          intensity: string
          note: string | null
          organization_id: string
          statement_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          intensity?: string
          note?: string | null
          organization_id: string
          statement_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intensity?: string
          note?: string | null
          organization_id?: string
          statement_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_diagnosis_selections_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategy_diagnosis_selections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_diagnosis_selections_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "strategy_diagnosis_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_diagnosis_statements: {
        Row: {
          code: string
          created_at: string
          dimension: string
          id: string
          sector_code: string
          sort_order: number
          statement: string
          status: string
          swot_category: string
          version: number
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          dimension: string
          id?: string
          sector_code?: string
          sort_order?: number
          statement: string
          status?: string
          swot_category: string
          version?: number
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          dimension?: string
          id?: string
          sector_code?: string
          sort_order?: number
          statement?: string
          status?: string
          swot_category?: string
          version?: number
          weight?: number
        }
        Relationships: []
      }
      strategy_priority_selections: {
        Row: {
          business_unit_id: string
          created_at: string
          created_by: string | null
          dimension: string
          id: string
          organization_id: string
          selected: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          dimension: string
          id?: string
          organization_id: string
          selected?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          dimension?: string
          id?: string
          organization_id?: string
          selected?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_priority_sel_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategy_priority_selections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_priority_selections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_recommendation_decisions: {
        Row: {
          applied_at: string | null
          applied_objective_id: string | null
          business_unit_id: string
          created_at: string
          created_by: string | null
          custom_description: string | null
          custom_title: string | null
          decision: string
          id: string
          organization_id: string
          reasons: Json
          score: number | null
          template_objective_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_objective_id?: string | null
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          custom_description?: string | null
          custom_title?: string | null
          decision?: string
          id?: string
          organization_id: string
          reasons?: Json
          score?: number | null
          template_objective_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_objective_id?: string | null
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          custom_description?: string | null
          custom_title?: string | null
          decision?: string
          id?: string
          organization_id?: string
          reasons?: Json
          score?: number | null
          template_objective_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_recommendation_decisions_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategy_recommendation_decisions_objective_fk"
            columns: ["applied_objective_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategy_recommendation_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_recommendation_decisions_template_objective_id_fkey"
            columns: ["template_objective_id"]
            isOneToOne: false
            referencedRelation: "strategy_template_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_recommendation_kpi_decisions: {
        Row: {
          applied_at: string | null
          applied_kpi_id: string | null
          business_unit_id: string
          created_at: string
          created_by: string | null
          decision: string
          id: string
          organization_id: string
          template_kpi_id: string
          template_objective_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_kpi_id?: string | null
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          decision: string
          id?: string
          organization_id: string
          template_kpi_id: string
          template_objective_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_kpi_id?: string | null
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          decision?: string
          id?: string
          organization_id?: string
          template_kpi_id?: string
          template_objective_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_rec_kpi_dec_bu_fk"
            columns: ["business_unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "strategy_recommendation_kpi_decision_template_objective_id_fkey"
            columns: ["template_objective_id"]
            isOneToOne: false
            referencedRelation: "strategy_template_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_recommendation_kpi_decisions_applied_kpi_id_fkey"
            columns: ["applied_kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_recommendation_kpi_decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_recommendation_kpi_decisions_template_kpi_id_fkey"
            columns: ["template_kpi_id"]
            isOneToOne: false
            referencedRelation: "strategy_template_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_recommendation_kpi_decisions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_template_kpis: {
        Row: {
          code: string
          created_at: string
          description: string | null
          direction: string
          formula: string | null
          frequency: string
          id: string
          kpi_class: string
          name: string
          sort_order: number
          source_hint: string | null
          status: string
          template_objective_id: string
          unit: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          direction?: string
          formula?: string | null
          frequency?: string
          id?: string
          kpi_class: string
          name: string
          sort_order?: number
          source_hint?: string | null
          status?: string
          template_objective_id: string
          unit?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          direction?: string
          formula?: string | null
          frequency?: string
          id?: string
          kpi_class?: string
          name?: string
          sort_order?: number
          source_hint?: string | null
          status?: string
          template_objective_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_template_kpis_template_objective_id_fkey"
            columns: ["template_objective_id"]
            isOneToOne: false
            referencedRelation: "strategy_template_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_template_objectives: {
        Row: {
          base_weight: number
          code: string
          created_at: string
          description: string
          dimension: string
          id: string
          rationale: string
          sector_code: string
          sort_order: number
          stages: string[]
          status: string
          title: string
          version: number
        }
        Insert: {
          base_weight?: number
          code: string
          created_at?: string
          description: string
          dimension: string
          id?: string
          rationale: string
          sector_code?: string
          sort_order?: number
          stages?: string[]
          status?: string
          title: string
          version?: number
        }
        Update: {
          base_weight?: number
          code?: string
          created_at?: string
          description?: string
          dimension?: string
          id?: string
          rationale?: string
          sector_code?: string
          sort_order?: number
          stages?: string[]
          status?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      user_role_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          justification: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role_id: string
          scope_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          justification: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: string
          scope_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          justification?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string
          scope_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ura_assigned_by_fk"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ura_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ura_revoked_by_fk"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ura_role_fk"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ura_scope_fk"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ura_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string | null
          preferred_locale: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          preferred_locale?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          preferred_locale?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accessible_organization_ids: { Args: never; Returns: string[] }
      accessible_scope_ids: {
        Args: { p_code: string; p_scope_type: string }
        Returns: string[]
      }
      current_user_id: { Args: never; Returns: string }
      f1_entity_scope_id: {
        Args: { p_target_id: string; p_target_table: string }
        Returns: string
      }
      f12_apply_strategy_draft: { Args: { p_plan_id: string }; Returns: Json }
      f12_assessment_version: { Args: never; Returns: number }
      f12_dimension_pillar_aliases: {
        Args: { p_dimension: string }
        Returns: string[]
      }
      f12_dimension_pillar_title: {
        Args: { p_dimension: string }
        Returns: string
      }
      f2_bu_scope_id: { Args: { p_bu: string }; Returns: string }
      f2_generate_routine_executions: {
        Args: { p_template_id: string; p_until?: string }
        Returns: number
      }
      f8_activate_plan: { Args: { p_plan_id: string }; Returns: Json }
      f8_approve_plan: {
        Args: { p_notes?: string; p_plan_id: string }
        Returns: Json
      }
      f8_plan_completeness: { Args: { p_plan_id: string }; Returns: Json }
      f8_plan_completeness_core: { Args: { p_plan_id: string }; Returns: Json }
      f8_submit_plan_for_review: { Args: { p_plan_id: string }; Returns: Json }
      f85_can: {
        Args: { p_code: string; p_scope_id: string }
        Returns: boolean
      }
      f9_activate_initiative: {
        Args: { p_initiative_id: string }
        Returns: Json
      }
      f9_approve_initiative: {
        Args: { p_initiative_id: string; p_notes?: string }
        Returns: Json
      }
      f9_derive_action_plan: {
        Args: { p_due_date?: string; p_initiative_id: string }
        Returns: Json
      }
      f9_initiative_readiness: {
        Args: { p_initiative_id: string }
        Returns: Json
      }
      f9_submit_initiative_for_review: {
        Args: { p_initiative_id: string }
        Returns: Json
      }
      gmos_assign_role: {
        Args: {
          p_justification: string
          p_role_code: string
          p_scope_id: string
          p_user_id: string
        }
        Returns: string
      }
      gmos_company_visible_by_unit: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      gmos_has_active_role: { Args: { p_code: string }; Returns: boolean }
      gmos_is_group_privileged: { Args: never; Returns: boolean }
      gmos_is_own_record: { Args: { p_user_id: string }; Returns: boolean }
      gmos_my_authorization: { Args: never; Returns: Json }
      gmos_revoke_role: {
        Args: { p_assignment_id: string; p_justification: string }
        Returns: undefined
      }
      gmos_scope_is_same_or_descendant: {
        Args: { p_assigned_scope_id: string; p_candidate_scope_id: string }
        Returns: boolean
      }
      gmos_template_assigned_to_me: {
        Args: { p_template_id: string }
        Returns: boolean
      }
      gmos_user_visible: { Args: { p_user_id: string }; Returns: boolean }
      has_permission: {
        Args: { p_code: string; p_scope_id: string; p_scope_type: string }
        Returns: boolean
      }
      organization_root_scope_id: { Args: { p_org: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
