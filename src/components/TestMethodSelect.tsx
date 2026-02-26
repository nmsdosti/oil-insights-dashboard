import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_METHODS = [
  "ASTM D445 (2024)",
  "ASTM D2270 (2016)",
  "ASTM D6304 (2020)",
  "ASTM D664 (2024)",
];

interface TestMethodSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const TestMethodSelect = ({ value, onChange }: TestMethodSelectProps) => {
  const [methods, setMethods] = useState<string[]>(DEFAULT_METHODS);
  const [newMethod, setNewMethod] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    const { data } = await supabase.from("test_methods").select("method_name");
    if (data) {
      const saved = data.map((d: any) => d.method_name);
      const all = [...new Set([...DEFAULT_METHODS, ...saved])];
      setMethods(all);
    }
  };

  const addMethod = async () => {
    if (!newMethod.trim()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("test_methods").insert({
      user_id: user.id,
      method_name: newMethod.trim(),
    });

    if (error) {
      toast.error("Failed to save method");
    } else {
      toast.success("Method added!");
      setMethods([...methods, newMethod.trim()]);
      onChange(newMethod.trim());
      setNewMethod("");
      setDialogOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select test method" />
        </SelectTrigger>
        <SelectContent>
          {methods.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Test Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="e.g., ASTM D4294 (2021)"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMethod()}
            />
            <Button onClick={addMethod} className="w-full">Add Method</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestMethodSelect;
