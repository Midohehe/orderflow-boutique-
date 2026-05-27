import { UserCircle } from "lucide-react";
import CityCorrections from "@/components/CityCorrections";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import { useUserContext } from "@/hooks/useUserContext";
import { PageHeader } from "@/components/PageHeader";

const AccountSettings = () => {
  const { isAdmin } = useUserContext();

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <PageHeader
        icon={UserCircle}
        title="حسابي"
        description='يمكنك تعديل بيانات الحساب من تبويب "هيدر المتجر".'
        iconGradient="from-sky-500 to-blue-600"
      />

      <IntegrationsPanel />
      {isAdmin && <CityCorrections />}
    </div>
  );
};

export default AccountSettings;