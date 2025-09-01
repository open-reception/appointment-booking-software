<script lang="ts">
	import { m } from "$i18n/messages";
	import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
	import { ROUTES } from "$lib/const/routes";
</script>

<SidebarLayout
	breakcrumbs={[
		{
			label: m["nav.tenants"](),
			href: ROUTES.DASHBOARD.TENANTS
		}
	]}
></SidebarLayout>
