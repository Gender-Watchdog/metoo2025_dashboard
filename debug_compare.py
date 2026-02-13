import csv

def compare_counts():
    try:
        old_data = {}
        with open('sources/dc_inside_post_urls.pre_purge.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                old_data[row['english_name']] = int(row['initial_count'])

        differences = []
        with open('sources/dc_inside_post_urls.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row['english_name']
                curr = int(row['initial_count'])
                if name in old_data:
                    old = old_data[name]
                    if curr != old:
                        differences.append((name, old, curr))

        print("Checking for ANY changes in initial_count:")
        if not differences:
            print("No changes found.")
        for name, old, curr in differences:
            print(f"{name}: {old} -> {curr}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    compare_counts()
