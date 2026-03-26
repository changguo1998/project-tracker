<template>
    <div class="project-time-table-container">
        <v-table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Project 1</th>
                    <th>Project 2</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Today</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr>
                    <td>2023-01-01</td>
                    <td></td>
                    <td></td>
                </tr>
            </tbody>
        </v-table>
    </div>
</template>

<script setup lang="ts">
import { Project, Log } from "@/types/main";
</script>

<style>
.project-time-table-container {
    width: 100%;
    background-color: mediumseagreen;
    padding: 20px;
    border-radius: 10px;
    margin: 10px;
}
.project-time-table-container tr>td {
    padding: 10px;
}
</style>
