"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assemblyStepSchema, stepBomItemSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── READ ACTIONS ───────────────────────────────────────────────

export async function getAssemblySteps(sku: string) {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: steps, error } = await supabase
      .from("assembly_steps")
      .select("step_id, sku, step_name, seq_no, is_final_step, created_at")
      .eq("sku", sku)
      .order("seq_no", { ascending: true });

    if (error) {
      return { success: false as const, error: error.message };
    }

    // Get BOM counts for each step
    const stepIds = (steps ?? []).map((s) => s.step_id);
    let bomCounts: Record<string, number> = {};

    if (stepIds.length > 0) {
      const { data: bomData } = await supabase
        .from("step_bom")
        .select("step_id")
        .in("step_id", stepIds);

      if (bomData) {
        for (const row of bomData) {
          bomCounts[row.step_id] = (bomCounts[row.step_id] || 0) + 1;
        }
      }
    }

    const result = (steps ?? []).map((s) => ({
      ...s,
      bom_count: bomCounts[s.step_id] || 0,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function getStepBom(stepId: string) {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: bomItems, error } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per, kodu")
      .eq("step_id", stepId)
      .order("step_bom_id");

    if (error) {
      return { success: false as const, error: error.message };
    }

    if (!bomItems || bomItems.length === 0) {
      return { success: true as const, data: [] };
    }

    // Separate ASM references from regular parts
    const asmIds: string[] = [];
    const partIds: string[] = [];

    for (const item of bomItems) {
      if (item.part_id.startsWith("ASM-")) {
        asmIds.push(item.part_id);
      } else {
        partIds.push(item.part_id);
      }
    }

    // Fetch part names
    const partNameMap = new Map<string, { name: string; type: string | null }>();

    if (partIds.length > 0) {
      const { data: parts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi, part_type")
        .in("part_id", partIds);

      if (parts) {
        for (const p of parts) {
          partNameMap.set(p.part_id, {
            name: p.part_adi || "—",
            type: p.part_type,
          });
        }
      }
    }

    // Fetch ASM step names
    if (asmIds.length > 0) {
      const { data: asmSteps } = await supabase
        .from("assembly_steps")
        .select("step_id, step_name")
        .in("step_id", asmIds);

      if (asmSteps) {
        for (const s of asmSteps) {
          partNameMap.set(s.step_id, {
            name: s.step_name || s.step_id,
            type: null,
          });
        }
      }
    }

    const result = bomItems.map((item) => {
      const info = partNameMap.get(item.part_id);
      return {
        step_bom_id: item.step_bom_id,
        step_id: item.step_id,
        part_id: item.part_id,
        part_name: info?.name || item.part_id,
        part_type: info?.type || null,
        is_asm_reference: item.part_id.startsWith("ASM-"),
        qty_per: item.qty_per,
        kodu: item.kodu,
      };
    });

    return { success: true as const, data: result };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

interface RecipeTreeItem {
  step_bom_id: string;
  part_id: string;
  part_name: string;
  qty_per: number;
  is_asm_reference: boolean;
  part_type: string | null;
  sub_tree?: RecipeTreeNode;
}

interface RecipeTreeNode {
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  items: RecipeTreeItem[];
}

export async function getRecipeTree(sku: string) {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Fetch all steps for this SKU
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("step_id, step_name, seq_no, is_final_step")
      .eq("sku", sku)
      .order("seq_no");

    if (!steps || steps.length === 0) {
      return { success: true as const, data: [] as RecipeTreeNode[] };
    }

    // Fetch all BOM items for these steps
    const stepIds = steps.map((s) => s.step_id);
    const { data: allBom } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per, kodu")
      .in("step_id", stepIds);

    // Fetch all part names
    const allPartIds = [
      ...new Set((allBom ?? []).map((b) => b.part_id).filter((id) => !id.startsWith("ASM-"))),
    ];
    const partNameMap = new Map<string, { name: string; type: string | null }>();

    if (allPartIds.length > 0) {
      const { data: parts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi, part_type")
        .in("part_id", allPartIds);

      if (parts) {
        for (const p of parts) {
          partNameMap.set(p.part_id, {
            name: p.part_adi || "—",
            type: p.part_type,
          });
        }
      }
    }

    // Step name map
    const stepMap = new Map(steps.map((s) => [s.step_id, s]));

    // Group BOM by step_id
    const bomByStep = new Map<string, typeof allBom>();
    for (const b of allBom ?? []) {
      const list = bomByStep.get(b.step_id) || [];
      list.push(b);
      bomByStep.set(b.step_id, list);
    }

    // Build tree recursively with cycle detection
    function buildNode(stepId: string, visited: Set<string>): RecipeTreeNode | null {
      if (visited.has(stepId)) return null; // cycle guard
      const step = stepMap.get(stepId);
      if (!step) return null;

      visited.add(stepId);
      const bomItems = bomByStep.get(stepId) || [];

      const items: RecipeTreeItem[] = bomItems.map((b) => {
        const isAsm = b.part_id.startsWith("ASM-");
        const info = isAsm
          ? { name: stepMap.get(b.part_id)?.step_name || b.part_id, type: null }
          : partNameMap.get(b.part_id) || { name: b.part_id, type: null };

        const item: RecipeTreeItem = {
          step_bom_id: b.step_bom_id,
          part_id: b.part_id,
          part_name: info.name,
          qty_per: b.qty_per,
          is_asm_reference: isAsm,
          part_type: info.type,
        };

        if (isAsm) {
          const subTree = buildNode(b.part_id, new Set(visited));
          if (subTree) {
            item.sub_tree = subTree;
          }
        }

        return item;
      });

      return {
        step_id: step.step_id,
        step_name: step.step_name,
        seq_no: step.seq_no,
        is_final_step: step.is_final_step,
        items,
      };
    }

    const tree: RecipeTreeNode[] = [];
    for (const step of steps) {
      const node = buildNode(step.step_id, new Set());
      if (node) tree.push(node);
    }

    return { success: true as const, data: tree };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

export async function reorderSteps(
  sku: string,
  orderedStepIds: string[]
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Update seq_no for each step
    for (let i = 0; i < orderedStepIds.length; i++) {
      const { error } = await supabase
        .from("assembly_steps")
        .update({ seq_no: i + 1 })
        .eq("step_id", orderedStepIds[i])
        .eq("sku", sku);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    revalidatePath("/admin/bom");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function createStep(
  sku: string,
  formData: { step_name: string; seq_no: number; is_final_step: boolean }
): Promise<ActionResult & { step_id?: string }> {
  try {
    await requireAdmin();

    const parsed = assemblyStepSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Generate next ASM-XXXX id
    const { data: lastStep } = await supabase
      .from("assembly_steps")
      .select("step_id")
      .like("step_id", "ASM-%")
      .order("step_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastStep && lastStep.length > 0) {
      const match = lastStep[0].step_id.match(/ASM-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const stepId = `ASM-${String(nextNum).padStart(4, "0")}`;

    const { error } = await supabase.from("assembly_steps").insert({
      step_id: stepId,
      sku,
      step_name: parsed.data.step_name,
      seq_no: parsed.data.seq_no,
      is_final_step: parsed.data.is_final_step,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/bom");
    return { success: true, step_id: stepId };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateStep(
  stepId: string,
  formData: { step_name: string; seq_no: number; is_final_step: boolean }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = assemblyStepSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("assembly_steps")
      .update({
        step_name: parsed.data.step_name,
        seq_no: parsed.data.seq_no,
        is_final_step: parsed.data.is_final_step,
      })
      .eq("step_id", stepId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/bom");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deleteStep(stepId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Check if this step is referenced as a BOM item (DAG safety)
    const { data: refs } = await supabase
      .from("step_bom")
      .select("step_bom_id")
      .eq("part_id", stepId)
      .limit(1);

    if (refs && refs.length > 0) {
      return {
        success: false,
        error:
          "Bu adım başka bir adımın malzeme listesinde referans olarak kullanılıyor. Önce referansları kaldırın.",
      };
    }

    // Delete BOM items of this step first
    await supabase.from("step_bom").delete().eq("step_id", stepId);

    // Delete the step
    const { error } = await supabase
      .from("assembly_steps")
      .delete()
      .eq("step_id", stepId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/bom");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function addBomItem(
  stepId: string,
  kodu: string | null,
  formData: { part_id: string; qty_per: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = stepBomItemSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Generate next SBOM-XXXX id
    const { data: lastBom } = await supabase
      .from("step_bom")
      .select("step_bom_id")
      .like("step_bom_id", "SBOM-%")
      .order("step_bom_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastBom && lastBom.length > 0) {
      const match = lastBom[0].step_bom_id.match(/SBOM-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const stepBomId = `SBOM-${String(nextNum).padStart(4, "0")}`;

    const { error } = await supabase.from("step_bom").insert({
      step_bom_id: stepBomId,
      step_id: stepId,
      part_id: parsed.data.part_id,
      qty_per: parsed.data.qty_per,
      kodu: kodu,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/bom");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateBomItem(
  stepBomId: string,
  formData: { part_id: string; qty_per: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = stepBomItemSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("step_bom")
      .update({
        part_id: parsed.data.part_id,
        qty_per: parsed.data.qty_per,
      })
      .eq("step_bom_id", stepBomId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/bom");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deleteBomItem(
  stepBomId: string
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const supabase = await createClient();
    const { error } = await supabase
      .from("step_bom")
      .delete()
      .eq("step_bom_id", stepBomId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/bom");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function exportBomData(sku: string): Promise<
  | {
      success: true;
      data: {
        step_id: string;
        step_name: string | null;
        seq_no: number | null;
        step_bom_id: string;
        part_id: string;
        part_name: string | null;
        qty_per: number;
      }[];
    }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Get steps
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("step_id, step_name, seq_no")
      .eq("sku", sku)
      .order("seq_no");

    if (!steps || steps.length === 0) {
      return { success: true, data: [] };
    }

    // Get BOM items
    const stepIds = steps.map((s) => s.step_id);
    const { data: bomItems } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per")
      .in("step_id", stepIds)
      .order("step_bom_id");

    // Get part names
    const partIds = [...new Set((bomItems ?? []).map((b) => b.part_id).filter((id) => !id.startsWith("ASM-")))];
    const partNameMap = new Map<string, string>();

    if (partIds.length > 0) {
      const { data: parts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi")
        .in("part_id", partIds);
      if (parts) {
        for (const p of parts) {
          partNameMap.set(p.part_id, p.part_adi || "");
        }
      }
    }

    // Get ASM step names
    const asmIds = [...new Set((bomItems ?? []).map((b) => b.part_id).filter((id) => id.startsWith("ASM-")))];
    if (asmIds.length > 0) {
      const { data: asmSteps } = await supabase
        .from("assembly_steps")
        .select("step_id, step_name")
        .in("step_id", asmIds);
      if (asmSteps) {
        for (const s of asmSteps) {
          partNameMap.set(s.step_id, s.step_name || s.step_id);
        }
      }
    }

    const stepMap = new Map(steps.map((s) => [s.step_id, s]));

    const result = (bomItems ?? []).map((b) => {
      const step = stepMap.get(b.step_id);
      return {
        step_id: b.step_id,
        step_name: step?.step_name ?? null,
        seq_no: step?.seq_no ?? null,
        step_bom_id: b.step_bom_id,
        part_id: b.part_id,
        part_name: partNameMap.get(b.part_id) ?? null,
        qty_per: b.qty_per,
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
