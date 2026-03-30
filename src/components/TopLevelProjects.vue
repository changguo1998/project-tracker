<template>
    <div class="level1-list-container">
        <v-sheet>
            <v-chip-group>
                <v-chip
                    v-for="p in projectList"
                    @click="shownProjectStore.switchShownFlag(p)"
                    :variant="shownProjectStore.isShown(p) ? 'elevated' : 'outlined'"
                    >{{ p }}</v-chip
                >
            </v-chip-group>
        </v-sheet>
    </div>
</template>

<script setup lang="ts">
import { useProjectStore } from "@/stores/projectStore";
import { useShownProjectStore } from "@/stores/shownProjectStore";

const projectStore = useProjectStore();
const projectList = Array.from(projectStore.getLevel1());
const shownProjectStore = useShownProjectStore();
shownProjectStore.update();
</script>
<style>
.level1-list-container {
    width: 100%;
    height: auto;
    padding: 10px;
    border-radius: 10px;
    margin: 10px;
}

.level1-list-container v-chip {
    margin: 10px;
    padding: 5px;
    border-radius: 5px;
    font-size: normal;
    background-color: darkgreen;
    color: black;
}
</style>
