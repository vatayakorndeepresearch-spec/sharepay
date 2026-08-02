<script lang="ts">
    export let name: string | null | undefined = null;
    export let avatarUrl: string | null | undefined = null;
    export let caption = "บัญชีปัจจุบัน";
</script>

<div class="identity-chip">
    {#if avatarUrl}
        <img
            src={avatarUrl}
            alt=""
            class="h-7 w-7 rounded-full object-cover"
            referrerpolicy="no-referrer"
        />
    {:else}
        <div class="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-on-soft">
            {(name || "?").trim().charAt(0).toUpperCase()}
        </div>
    {/if}
    <div class="min-w-0">
        <div class="truncate text-sm font-medium text-text">{name || "ไม่พบโปรไฟล์"}</div>
        <div class="text-xs text-muted">{caption}</div>
    </div>
</div>
