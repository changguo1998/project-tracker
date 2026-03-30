<template>
    <div class="header-container">
            <v-btn variant="outlined">Home</v-btn>
            <v-btn variant="outlined">Sync</v-btn>
            <v-btn variant="outlined">Settings</v-btn>
    </div>
</template>
<script setup lang="ts">
</script>
<style>
.header-container {
    display: flex;
    justify-content: left;
    width: 100%;
    height: auto;
    border-radius: 10px;
    padding: 2px;
}
.header-container v-btn {
    margin: 5px;
    margin-left: 10px;
    margin-right: 10px;
}
</style>
