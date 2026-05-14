import { UserCircle } from "lucide-react";
import CityCorrections from "@/components/CityCorrections";
import { useUserContext } from "@/hooks/useUserContext";

const AccountSettings = () => {
  const { isAdmin } = useUserContext();

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCircle className="w-7 h-7" /> حسابي</h1>
        <p className="text-muted-foreground">يمكنك تعديل بيانات الحساب من تبويب "هيدر المتجر".</p>
      </div>

      {isAdmin && <CityCorrections />}
    </div>
  );
};

export default AccountSettings;