import DashboardStats from "@/components/DashboardStats";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const Dashboard = () => {
  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={LayoutDashboard}
        title="لوحة التحكم"
        description="نظرة عامة على أداء متجرك"
        iconGradient="from-blue-500 to-indigo-600"
      />

      <DashboardStats />
    </div>
  );
};

export default Dashboard;
