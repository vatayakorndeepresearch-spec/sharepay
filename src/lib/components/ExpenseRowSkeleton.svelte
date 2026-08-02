<script lang="ts">
    export let rows = 5;
</script>

<div class="grid gap-2" aria-hidden="true">
    {#each Array(rows) as _, index (index)}
        <div class="surface-card flex items-center gap-3 p-3">
            <div class="skeleton h-9 w-9 shrink-0 rounded-lg"></div>
            <div class="flex-1 space-y-2">
                <div class="skeleton h-3.5" style={`width: ${55 + ((index * 13) % 30)}%`}></div>
                <div class="skeleton h-3 w-2/5"></div>
            </div>
            <div class="skeleton h-4 w-16 shrink-0"></div>
        </div>
    {/each}
</div>
