import { page } from "$app/state";
import { ROUTES } from "$lib/const/routes";

export const isCurrentSection = (sectionPath: string): boolean => {
	// Select home when on dashboard main
	if (page.url.pathname === ROUTES.DASHBOARD.MAIN && sectionPath === ROUTES.DASHBOARD.MAIN) {
		return true;
	}

	// Not always select home
	if (page.url.pathname.startsWith(sectionPath) && sectionPath === ROUTES.DASHBOARD.MAIN) {
		return false;
	}

	return page.url.pathname.startsWith(sectionPath);
};
