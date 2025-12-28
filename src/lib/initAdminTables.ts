import { supabase } from "@/integrations/supabase/client";

export const initializeAdminTables = async () => {
  try {
    console.log("Initializing admin tables...");

    // Check if admin_data table exists by trying to select from it
    const { error: checkError } = await supabase
      .from("admin_data")
      .select("key")
      .limit(1);

    if (checkError && checkError.message?.includes('relation "public.admin_data" does not exist')) {
      console.log("Admin tables don't exist. Please run the migration: supabase db reset");
      return false;
    }

    // Insert default values if they don't exist
    const { error: insertError } = await supabase
      .from("admin_data")
      .upsert([
        { key: 'visitor_count', value: '0' },
        { key: 'accounts_signed_up', value: '0' },
        { key: 'revenue', value: '0' }
      ], { onConflict: 'key' });

    if (insertError) {
      console.error("Error initializing admin data:", insertError);
      return false;
    }

    console.log("Admin tables initialized successfully!");
    return true;
  } catch (error) {
    console.error("Failed to initialize admin tables:", error);
    return false;
  }
};
