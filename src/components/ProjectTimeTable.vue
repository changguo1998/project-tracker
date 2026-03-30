<template>
    <div class="project-time-table-container">
        <v-table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th
                        v-for="p in shownProjectList"
                        :key="p"
                    >
                        {{ projectStore.getByID(p)?.projectName }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="d in allDateList"
                    :key="d"
                >
                    <td>{{ d }}</td>
                    <td
                        v-for="p in shownProjectList"
                        :key="p"
                    >
                        {{
                        (logStore.getByID(p)?.date===d && logStore.getByID(p)?.projectID===p)
                            ? logStore.getByID(p)?.summary || ""
                            : ""
                        }}
                    </td>
                </tr>
            </tbody>
        </v-table>
    </div>
</template>

<script setup lang="ts">
import { useLogStore } from "@/stores/logStore";
import { useProjectStore } from "@/stores/projectStore";
import { useShownProjectStore } from "@/stores/shownProjectStore";

const logStore = useLogStore();
const projectStore = useProjectStore();
const shownProjectStore = useShownProjectStore();
shownProjectStore.update();
const shownProjectList = Array.from(shownProjectStore.shownProjectSet.keys());
const dateList = Array.from(logStore.logMap.keys())
    .map((id) => logStore.getByID(id)?.date)
    .filter((date) => date !== undefined)
    .sort()
    .reverse();
const today = new Date().toISOString().split('T')[0];
const nextNDaysFromToday = 3;
const nextNDayStrings = Array.from({ length: nextNDaysFromToday }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
});
const allDateList = [...dateList, ...nextNDayStrings];
allDateList.sort().reverse();
</script>

<style>
.project-time-table-container {
    width: 100%;
    padding: 20px;
    border-radius: 10px;
    margin: 10px;
    flex: 1;
}
.project-time-table-container tr > td {
    padding: 10px;
}
</style>
