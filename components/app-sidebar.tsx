import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MenuItem } from "@/components/menu-item";

const items = [
  // {
  //   title: "Dashboard",
  //   url: "/dashboard",
  //   icon: "dashboard",
  // },
  {
    title: "Overview",
    url: "/dashboard/overview",
    icon: "overview",
  },
  {
    title: "HeatMap",
    url: "/dashboard/heatmap",
    icon: "heatmap",
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between gap-2">
        <div className="text-blue-950 font-bold">
          Illinois State Water Survey
        </div>
        <Image
          className="inline-block"
          src="/ISWS-Icon.png"
          alt="ISWS Water Quality Dashboard"
          width={40}
          height={40}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Getting Started</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton>
                    <MenuItem
                      item={
                        item as {
                          title: "HeatMap" | "Overview";
                          url: string;
                          icon: "heatmap" | "overview";
                        }
                      }
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
