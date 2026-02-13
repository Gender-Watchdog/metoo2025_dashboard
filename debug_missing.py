import csv

def find_missing():
    old = set()
    with open('sources/dc_inside_post_urls.pre_purge.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            old.add(row['english_name'])

    new = set()
    with open('sources/dc_inside_post_urls.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            new.add(row['english_name'])

    missing = old - new
    added = new - old

    print(f"Missing (Purged?): {len(missing)}")
    for m in missing:
        print(f"- {m}")

    print(f"New (Added): {len(added)}")
    for a in added:
        print(f"+ {a}")

if __name__ == "__main__":
    find_missing()
