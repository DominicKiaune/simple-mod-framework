<script lang="ts">
	import "../app.css"
	import "carbon-components-svelte/css/g90.css"
	import { onMount } from "svelte"

	import Icon from "svelte-fa"
	import { faBook, faCog, faEdit, faHome, faInfoCircle, faList } from "@fortawesome/free-solid-svg-icons"
	import { getConfig } from "$lib/utils"
	import { page } from "$app/stores"

	let ready: boolean = false
	onMount(() => (ready = true))

	window.ipc.receive("urlScheme", async (path: string) => {
		if (path.startsWith("install/")) {
			window.location.href = "/modList?urlScheme=" + encodeURIComponent(path.replace("install/", ""))
		} else if (path.startsWith("open-docs-page/")) {
			window.location.href = "/docs/" + path.replace("open-docs-page/", "")
		}
	})
</script>

{#if ready}
	<div class="flex flex-row h-screen w-screen">
		<div class="bg-neutral-900 w-16 h-full flex flex-col gap-16 items-center justify-center">
			<a href="/" data-sveltekit-reload class="text-white">
				<Icon icon={faHome} />
			</a>
			<a href="/modList" data-sveltekit-reload class="text-white">
				<Icon icon={faList} />
			</a>
			<a href="/settings" data-sveltekit-reload class="text-white">
				<Icon icon={faCog} />
			</a>
			{#if getConfig().developerMode}
				<a href="/authoring" data-sveltekit-reload class="text-white">
					<Icon icon={faEdit} />
				</a>
				<a href="/docs/Index.md" class="text-white">
					<Icon icon={faBook} />
				</a>
			{/if}
			<a href="/info" data-sveltekit-reload class="text-white">
				<Icon icon={faInfoCircle} />
			</a>
		</div>
		<div class="col-span-11 px-16 py-8 w-full">
			<slot />
		</div>
	</div>
{/if}

<style>
	:global(.bx--content) {
		background-color: initial;
	}
</style>
