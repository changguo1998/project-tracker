<template>
    <div class="header-container">
        <v-menu>
            <v-menu-item>Home</v-menu-item>
            <v-menu-item>Sync</v-menu-item>
            <v-menu-item>Settings</v-menu-item>
        </v-menu>
    </div>
</template>
<script setup lang="ts">
</script>
<style>
.header-container {
    display: flex;
    background-color: seagreen;
    justify-content: space-between;
    align-items: left;
    width: 100%;
    border-radius: 10px;
}
.header-container v-menu-item {
    margin: 20px;
    font-size: normal;
    color: black;
}
</style>
