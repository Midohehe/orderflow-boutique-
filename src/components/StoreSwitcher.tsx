import { useStoreContext } from "@/hooks/useStoreContext";
import { Store as StoreIcon, Check, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

const StoreSwitcher = ({ collapsed = false }: Props) => {
  const { stores, activeStore, activeStoreId, setActiveStoreId, loading } = useStoreContext();
  const navigate = useNavigate();

  if (loading) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground border border-sidebar-border",
            collapsed && "md:justify-center md:px-2"
          )}
        >
          <StoreIcon className="w-4 h-4 flex-shrink-0" />
          <span className={cn("truncate text-sm", collapsed && "md:hidden")}>
            {activeStore?.name || "اختر متجراً"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" dir="rtl">
        <DropdownMenuLabel>متاجري</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => setActiveStoreId(s.id)} className="cursor-pointer">
            <span className="flex-1 truncate">{s.name}</span>
            {s.id === activeStoreId && <Check className="w-4 h-4 ml-2 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/dashboard/my-stores")} className="cursor-pointer">
          <Plus className="w-4 h-4 ml-2" />
          إدارة المتاجر
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StoreSwitcher;
